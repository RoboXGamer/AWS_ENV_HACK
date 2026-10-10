import { useStore } from '../state/store';

/** KPI cards + optimized-vs-baseline comparison. */
export function SummaryPanel() {
  const { result, computing } = useStore();

  if (!result || !result.ok || !result.metrics) {
    return (
      <section className="panel">
        <div className="summary-empty">
          <h2>{computing ? 'Optimizing…' : 'No plan yet'}</h2>
          <p className="muted">
            Add products and box sizes, then run the optimizer to see utilization and savings.
          </p>
        </div>
      </section>
    );
  }

  const { metrics, baseline, savings, elapsedMs } = result;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  const kpis = [
    { label: 'Boxes required', value: String(metrics.boxes), sub: `${metrics.itemsPlaced} items packed` },
    { label: 'Space utilization', value: pct(metrics.utilization), sub: `${((1 - metrics.utilization) * 100).toFixed(1)}% empty` },
    { label: 'Boxes saved', value: `${(savings?.boxesSavedPct ?? 0).toFixed(0)}%`, sub: `${savings?.boxesSaved ?? 0} vs one-per-item`, tone: 'good' },
    { label: 'Volume saved', value: `${(savings?.volumeSavedPct ?? 0).toFixed(0)}%`, sub: 'less shipping space', tone: 'good' },
    { label: 'Material saved', value: `$${(savings?.materialSaved ?? 0).toFixed(2)}`, sub: `$${metrics.boxCost.toFixed(2)} spent`, tone: 'good' },
    { label: 'Shipping saved', value: `$${(savings?.shippingSaved ?? 0).toFixed(2)}`, sub: 'volumetric charges', tone: 'good' },
  ];

  const maxBoxes = Math.max(baseline?.boxes ?? 1, metrics.boxes, 1);

  return (
    <section className="panel summary">
      <div className="summary-head">
        <h2>Optimization summary</h2>
        <span className="muted small">solved in {elapsedMs.toFixed(0)} ms</span>
      </div>

      <div className="kpi-grid">
        {kpis.map((k) => (
          <div key={k.label} className={k.tone ? 'kpi good' : 'kpi'}>
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-value">{k.value}</span>
            <span className="kpi-sub">{k.sub}</span>
          </div>
        ))}
      </div>

      <div className="compare">
        <h3>Optimized vs. naive one-item-per-box</h3>
        <div className="compare-row">
          <span className="compare-label">Boxes</span>
          <div className="compare-bar">
            <div className="bar naive" style={{ width: `${(baseline?.boxes ?? 0) / maxBoxes * 100}%` }}>
              {baseline?.boxes}
            </div>
            <div className="bar optimized" style={{ width: `${metrics.boxes / maxBoxes * 100}%` }}>
              {metrics.boxes}
            </div>
          </div>
        </div>
        <div className="compare-row">
          <span className="compare-label">Fill rate</span>
          <div className="compare-bar">
            <div className="bar naive" style={{ width: `${(baseline?.utilization ?? 0) * 100}%` }}>
              {((baseline?.utilization ?? 0) * 100).toFixed(0)}%
            </div>
            <div className="bar optimized" style={{ width: `${metrics.utilization * 100}%` }}>
              {(metrics.utilization * 100).toFixed(0)}%
            </div>
          </div>
        </div>
        <div className="legend">
          <span><i className="dot naive" /> Naive baseline</span>
          <span><i className="dot optimized" /> PackIQ optimized</span>
        </div>
      </div>
    </section>
  );
}