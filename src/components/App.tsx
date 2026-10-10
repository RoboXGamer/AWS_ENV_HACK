import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { BoxViewer3D, useBoxSummary } from './BoxViewer3D';
import { PlanTable } from './PlanTable';
import { SummaryPanel } from './SummaryPanel';
import { ProductEditor } from './ProductEditor';
import { BoxEditor } from './BoxEditor';
import { SettingsPanel } from './SettingsPanel';
import { Toasts } from './Toasts';

export function App() {
  const store = useStore();
  const {
    products, boxes, result, computing, selectedBox,
    runOptimization, loadDemo, clearAll,
    importProductsCsv, importBoxesCsv, selectBox,
    exportProductsCsv, exportBoxesCsv,
  } = store;

  const [activeTab, setActiveTab] = useState<'products' | 'boxes' | 'settings'>('products');
  const [autoRotate, setAutoRotate] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const productFileRef = useRef<HTMLInputElement>(null);
  const boxFileRef = useRef<HTMLInputElement>(null);

  // Run once on mount so the dashboard is never empty.
  const ranOnce = useRef(false);
  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;
    runOptimization();
  }, [runOptimization]);

  const selected = result?.boxes[selectedBox] ?? null;
  const summary = useBoxSummary(selected, products);

  const groupedBoxes = useMemo(() => {
    const map = new Map<string, { code: string; count: number; totalWeight: number; maxWeight: number; avgUtil: number }>();
    for (const b of result?.boxes ?? []) {
      const cur = map.get(b.boxTypeId) ?? {
        code: b.boxCode, count: 0, totalWeight: 0, maxWeight: b.weightLimit, avgUtil: 0,
      };
      cur.count += 1;
      cur.totalWeight += b.weight;
      cur.avgUtil += b.utilization;
      map.set(b.boxTypeId, cur);
    }
    return [...map.values()].map((g) => ({ ...g, avgUtil: g.avgUtil / g.count }));
  }, [result]);

  const totalUnits = products.reduce((s, p) => s + (p.quantity || 0), 0);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <svg viewBox="0 0 32 32" width="26" height="26">
              <path d="M16 3 29 10.5 16 18 3 10.5 16 3Z" fill="#4f8cff" />
              <path d="M3 10.5 16 18v11L3 21.5v-11Z" fill="#2f6ad6" />
              <path d="M29 10.5 16 18v11l13-7.5v-11Z" fill="#1b4bb0" />
            </svg>
          </div>
          <div>
            <h1>PackIQ</h1>
            <p className="tagline">Smart packaging optimization</p>
          </div>
        </div>

        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={loadDemo}>Load demo</button>
          <button className="btn btn-ghost" onClick={() => { if (confirm('Clear all products and boxes?')) clearAll(); }}>
            Clear
          </button>
          <button className="btn btn-primary" onClick={runOptimization} disabled={computing}>
            {computing ? 'Optimizing…' : 'Optimize packing'}
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="panel">
            <div className="tabs" role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === 'products'}
                className={activeTab === 'products' ? 'tab active' : 'tab'}
                onClick={() => setActiveTab('products')}
              >
                Products <span className="pill">{products.length}</span>
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'boxes'}
                className={activeTab === 'boxes' ? 'tab active' : 'tab'}
                onClick={() => setActiveTab('boxes')}
              >
                Boxes <span className="pill">{boxes.length}</span>
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'settings'}
                className={activeTab === 'settings' ? 'tab active' : 'tab'}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            </div>

            {activeTab === 'products' && (
              <ProductEditor
                totalUnits={totalUnits}
                onImportClick={() => productFileRef.current?.click()}
                onExport={exportProductsCsv}
              />
            )}
            {activeTab === 'boxes' && (
              <BoxEditor
                onImportClick={() => boxFileRef.current?.click()}
                onExport={exportBoxesCsv}
              />
            )}
            {activeTab === 'settings' && <SettingsPanel />}
          </div>
        </aside>

        <main className="main">
          <SummaryPanel />

          {result && !result.ok && (
            <div className="alert alert-error">
              <strong>Cannot optimize yet.</strong>
              <ul>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}

          {result?.ok && (
            <>
              <section className="panel viz-panel">
                <div className="viz-head">
                  <div>
                    <h2>3D packing preview</h2>
                    <p className="muted">
                      {selected
                        ? `Box ${selectedBox + 1} of ${result.boxes.length} · ${selected.boxCode} · ${selected.placements.length} items · ${(selected.utilization * 100).toFixed(1)}% full`
                        : 'No boxes to display'}
                    </p>
                  </div>
                  <div className="viz-controls">
                    <button className="btn btn-ghost" disabled={!selected} onClick={() => selectBox((selectedBox - 1 + result.boxes.length) % result.boxes.length)}>
                      ‹ Prev
                    </button>
                    <button className="btn btn-ghost" disabled={!selected} onClick={() => selectBox((selectedBox + 1) % result.boxes.length)}>
                      Next ›
                    </button>
                    <label className="check">
                      <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
                      Auto-rotate
                    </label>
                    <label className="check">
                      <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
                      SKU labels
                    </label>
                  </div>
                </div>

                <div className="viz-body">
                  {selected && (
                    <BoxViewer3D
                      key={selectedBox}
                      box={selected}
                      products={products}
                      autoRotate={autoRotate}
                      showLabels={showLabels}
                    />
                  )}
                  <div className="box-detail">
                    {selected && (
                      <>
                        <h3>Contents</h3>
                        <ul className="contents">
                          {summary.map((s) => (
                            <li key={s.productId}>
                              <span className="swatch" style={{ background: s.color }} />
                              <span className="contents-name" title={s.name}>{s.name}</span>
                              <span className="contents-count">×{s.count}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="meter">
                          <div className="meter-label">
                            <span>Space used</span>
                            <strong>{(selected.utilization * 100).toFixed(1)}%</strong>
                          </div>
                          <div className="meter-track">
                            <div
                              className="meter-fill"
                              style={{ width: `${Math.min(100, selected.utilization * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="meter">
                          <div className="meter-label">
                            <span>Weight</span>
                            <strong>{selected.weight.toFixed(2)} / {selected.weightLimit.toFixed(1)} kg</strong>
                          </div>
                          <div className="meter-track">
                            <div
                              className="meter-fill alt"
                              style={{ width: `${Math.min(100, (selected.weight / selected.weightLimit) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <p className="muted small">
                          Box: {selected.length}×{selected.width}×{selected.height} cm · ${selected.cost.toFixed(2)} each
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </section>

              {groupedBoxes.length > 0 && (
                <section className="panel">
                  <h2>Box mix</h2>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Box type</th>
                        <th>Count</th>
                        <th>Avg fill</th>
                        <th>Total weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedBoxes.map((g) => (
                        <tr key={g.code}>
                          <td><strong>{g.code}</strong></td>
                          <td>{g.count}</td>
                          <td>
                            <div className="mini-meter">
                              <div className="mini-fill" style={{ width: `${Math.min(100, g.avgUtil * 100)}%` }} />
                            </div>
                            <span className="small muted">{(g.avgUtil * 100).toFixed(0)}%</span>
                          </td>
                          <td>{g.totalWeight.toFixed(1)} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              <PlanTable />
            </>
          )}
        </main>
      </div>

      <input
        ref={productFileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) importProductsCsv(await file.text());
          e.target.value = '';
        }}
      />
      <input
        ref={boxFileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) importBoxesCsv(await file.text());
          e.target.value = '';
        }}
      />

      <Toasts />
    </div>
  );
}