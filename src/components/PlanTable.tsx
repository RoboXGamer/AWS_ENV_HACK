import { useStore } from '../state/store';
import { colorFor } from './BoxViewer3D';

/** Per-box packing plan table with a click-to-view hookup. */
export function PlanTable() {
  const { result, selectedBox, selectBox } = useStore();
  const { products } = useStore();

  if (!result?.ok) return null;

  return (
    <section className="panel">
      <div className="summary-head">
        <h2>Packing plan</h2>
        <span className="muted small">{result.boxes.length} boxes · click a row to preview it in 3D</span>
      </div>
      <div className="table-scroll plan-scroll">
        <table className="table table-plan">
          <thead>
            <tr>
              <th>#</th>
              <th>Box</th>
              <th>Items</th>
              <th>Fill</th>
              <th>Weight</th>
              <th>Contents</th>
            </tr>
          </thead>
          <tbody>
            {result.boxes.map((b, i) => (
              <tr
                key={i}
                className={i === selectedBox ? 'selected' : undefined}
                onClick={() => selectBox(i)}
              >
                <td className="idx">{i + 1}</td>
                <td><strong>{b.boxCode}</strong></td>
                <td>{b.placements.length}</td>
                <td>
                  <div className="fill-cell">
                    <div className="mini-meter">
                      <div
                        className="mini-fill"
                        style={{ width: `${Math.min(100, b.utilization * 100)}%` }}
                      />
                    </div>
                    <span className="small">{(b.utilization * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td className="small">
                  {b.weight.toFixed(2)} / {b.weightLimit.toFixed(1)} kg
                </td>
                <td>
                  <div className="contents-dots">
                    {[...new Set(b.placements.map((p) => p.productId))].slice(0, 8).map((pid) => (
                      <span
                        key={pid}
                        className="swatch sm"
                        style={{ background: colorFor(pid, products) }}
                        title={b.placements.find((p) => p.productId === pid)?.name}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}