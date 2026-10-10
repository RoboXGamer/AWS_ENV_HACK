/// <reference lib="webworker" />
/**
 * Optimization worker. Keeps the (potentially multi-second) packing search off
 * the main thread so the dashboard stays responsive while a plan is computed.
 */

import { optimize } from './optimizer';
import type { BoxType, OptimizationSettings, Product } from './types';

export interface WorkerRequest {
  id: number;
  products: Product[];
  boxes: BoxType[];
  settings: OptimizationSettings;
}

export type WorkerResponse =
  | { id: number; ok: true; result: ReturnType<typeof optimize> }
  | { id: number; ok: false; error: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, products, boxes, settings } = e.data;
  try {
    const result = optimize({ products, boxes, settings });
    const message: WorkerResponse = { id, ok: true, result };
    (self as unknown as Worker).postMessage(message);
  } catch (err) {
    const message: WorkerResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(message);
  }
};