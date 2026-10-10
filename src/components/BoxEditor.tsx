import { useStore } from '../state/store';

/** Editable box catalogue table. */
export function BoxEditor({
  onImportClick,
  onExport,
}: {
  onImportClick: () => void;
  onExport: () => void;
}) {
  const { boxes, addBox, updateBox, removeBox } = useStore();

  const setNum = (
    id: string,
    key: 'length' | 'width' | 'height' | 'weightLimit' | 'cost',
    v: string,
  ) => {
    const n = parseFloat(v);
    updateBox(id, { [key]: Number.isFinite(n) ? n : 0 });
  };

  return (
    <div className="editor">
      <div className="editor-actions">
        <button className="btn btn-primary btn-sm" onClick={addBox}>+ Box size</button>
        <button className="btn btn-ghost btn-sm" onClick={onImportClick}>Import CSV</button>
        <button className="btn btn-ghost btn-sm" onClick={onExport}>Export</button>
      </div>
      <p className="muted small">
        Inner dimensions and max gross weight, in cm and kg. Cost drives the material savings estimate.
      </p>

      <div className="table-scroll">
        <table className="table table-inputs">
          <thead>
            <tr>
              <th>Code</th>
              <th>L</th>
              <th>W</th>
              <th>H</th>
              <th>Max kg</th>
              <th>Cost</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {boxes.map((b) => (
              <tr key={b.id}>
                <td>
                  <input value={b.code}
                    onChange={(e) => updateBox(b.id, { code: e.target.value })}
                    aria-label={`Code for box ${b.code}`} />
                </td>
                <td>
                  <input className="num" type="number" value={b.length}
                    onChange={(e) => setNum(b.id, 'length', e.target.value)}
                    aria-label={`Length of ${b.code}`} />
                </td>
                <td>
                  <input className="num" type="number" value={b.width}
                    onChange={(e) => setNum(b.id, 'width', e.target.value)}
                    aria-label={`Width of ${b.code}`} />
                </td>
                <td>
                  <input className="num" type="number" value={b.height}
                    onChange={(e) => setNum(b.id, 'height', e.target.value)}
                    aria-label={`Height of ${b.code}`} />
                </td>
                <td>
                  <input className="num" type="number" step="0.5" value={b.weightLimit}
                    onChange={(e) => setNum(b.id, 'weightLimit', e.target.value)}
                    aria-label={`Weight limit of ${b.code}`} />
                </td>
                <td>
                  <input className="num" type="number" step="0.05" value={b.cost}
                    onChange={(e) => setNum(b.id, 'cost', e.target.value)}
                    aria-label={`Cost of ${b.code}`} />
                </td>
                <td>
                  <button className="icon-btn" title={`Remove ${b.code}`}
                    onClick={() => removeBox(b.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {boxes.length === 0 && <p className="empty">No box sizes yet. Add one or import a CSV.</p>}
      </div>
    </div>
  );
}