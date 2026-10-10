import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  boxesToCsv,
  DEMO_BOXES,
  DEMO_PRODUCTS,
  nextId,
  optimize,
  parseBoxesCsv,
  parseProductsCsv,
  productsToCsv,
} from '../engine';
import type {
  BoxType,
  OptimizationResult,
  OptimizationSettings,
  Product,
} from '../engine';
import type { WorkerRequest, WorkerResponse } from '../engine/optimizer.worker';
import OptimizerWorker from '../engine/optimizer.worker?worker';

const STORAGE_KEY = 'packiq.dataset.v1';

interface Dataset {
  products: Product[];
  boxes: BoxType[];
}

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  message: string;
}

interface StoreValue {
  products: Product[];
  boxes: BoxType[];
  settings: OptimizationSettings;
  result: OptimizationResult | null;
  computing: boolean;
  selectedBox: number;
  toasts: Toast[];

  setProducts: (products: Product[]) => void;
  setBoxes: (boxes: BoxType[]) => void  ;
  setSettings: (settings: OptimizationSettings) => void;
  addProduct: () => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  removeProduct: (id: string) => void;
  addBox: () => void;
  updateBox: (id: string, patch: Partial<BoxType>) => void;
  removeBox: (id: string) => void;
  loadDemo: () => void;
  clearAll: () => void;
  importProductsCsv: (text: string) => void;
  importBoxesCsv: (text: string) => void;
  selectBox: (index: number) => void;
  runOptimization: () => void;
  exportProductsCsv: () => void;
  exportBoxesCsv: () => void;
  notify: (kind: Toast['kind'], message: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function loadStored(): Dataset | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Dataset;
    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.boxes)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function download(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const stored = useMemo(loadStored, []);
  const [products, setProducts] = useState<Product[]>(stored?.products ?? DEMO_PRODUCTS);
  const [boxes, setBoxes] = useState<BoxType[]>(stored?.boxes ?? DEMO_BOXES);
  const [settings, setSettings] = useState<OptimizationSettings>({
    allowRotation: true,
    weightUtilizationLimit: 1,
    targetUtilization: 0.85,
    searchDepth: 2,
    maxItemsPerBox: 9999,
    shippingCostPerM3: 6,
  });
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [selectedBox, setSelectedBox] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const toastId = useRef(0);

  const notify = useCallback((kind: Toast['kind'], message: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  // Create the worker lazily and keep exactly one instance alive.
  useEffect(() => {
    let worker: Worker;
    try {
      worker = new OptimizerWorker();
    } catch {
      // Environments without module workers (rare) fall back to inline solving.
      workerRef.current = null;
      return;
    }
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const data = e.data;
      if (data.id !== requestId.current) return; // stale response
      setComputing(false);
      if (data.ok) {
        setResult(data.result);
        setSelectedBox(0);
        if (data.result.ok && data.result.warnings.length) {
          notify('info', data.result.warnings[0]);
        }
      } else {
        setResult(null);
        notify('error', data.error);
      }
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [notify]);

  const runOptimization = useCallback(() => {
    const id = ++requestId.current;
    setComputing(true);
    const worker = workerRef.current;
    if (!worker) {
      // Synchronous fallback.
      try {
        const res = optimize({ products, boxes, settings });
        setResult(res);
        setSelectedBox(0);
      } catch (err) {
        notify('error', err instanceof Error ? err.message : String(err));
      } finally {
        setComputing(false);
      }
      return;
    }
    const req: WorkerRequest = { id, products, boxes, settings };
    worker.postMessage(req);
  }, [products, boxes, settings, notify]);

  // Persist the working set so a refresh does not lose the operator's input.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, boxes }));
    } catch {
      /* quota or private mode: not fatal */
    }
  }, [products, boxes]);

  const value = useMemo<StoreValue>(() => {
    const mutateProducts = (updater: (prev: Product[]) => Product[]) => setProducts(updater);
    const mutateBoxes = (updater: (prev: BoxType[]) => BoxType[]) => setBoxes(updater);

    return {
      products,
      boxes,
      settings,
      result,
      computing,
      selectedBox,
      toasts,

      setProducts,
      setBoxes,
      setSettings,

      addProduct: () =>
        mutateProducts((prev) => [
          ...prev,
          {
            id: nextId('p'),
            sku: `SKU-${prev.length + 1}`,
            name: 'New product',
            length: 20,
            width: 15,
            height: 10,
            weight: 0.5,
            quantity: 1,
          },
        ]),
      updateProduct: (id, patch) =>
        mutateProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
      removeProduct: (id) => mutateProducts((prev) => prev.filter((p) => p.id !== id)),

      addBox: () =>
        mutateBoxes((prev) => [
          ...prev,
          {
            id: nextId('b'),
            code: `BOX-${prev.length + 1}`,
            length: 30,
            width: 20,
            height: 15,
            weightLimit: 10,
            cost: 0.6,
          },
        ]),
      updateBox: (id, patch) =>
        mutateBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b))),
      removeBox: (id) => mutateBoxes((prev) => prev.filter((b) => b.id !== id)),

      loadDemo: () => {
        setProducts(DEMO_PRODUCTS);
        setBoxes(DEMO_BOXES);
        notify('success', 'Demo dataset loaded.');
      },
      clearAll: () => {
        setProducts([]);
        setBoxes([]);
        setResult(null);
      },

      importProductsCsv: (text) => {
        const { products: parsed, errors } = parseProductsCsv(text);
        if (parsed.length === 0) {
          notify('error', errors[0] ?? 'No valid rows found in that CSV.');
          return;
        }
        setProducts(parsed);
        notify('success', `Imported ${parsed.length} product${parsed.length === 1 ? '' : 's'}.`);
      },
      importBoxesCsv: (text) => {
        const { boxes: parsed, errors } = parseBoxesCsv(text);
        if (parsed.length === 0) {
          notify('error', errors[0] ?? 'No valid rows found in that CSV.');
          return;
        }
        setBoxes(parsed);
        notify('success', `Imported ${parsed.length} box size${parsed.length === 1 ? '' : 's'}.`);
      },

      selectBox: setSelectedBox,
      runOptimization,

      exportProductsCsv: () => download('packiq-products.csv', productsToCsv(products)),
      exportBoxesCsv: () => download('packiq-boxes.csv', boxesToCsv(boxes)),
      notify,
    };
  }, [products, boxes, settings, result, computing, selectedBox, toasts, runOptimization, notify]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}