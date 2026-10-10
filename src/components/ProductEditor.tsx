import { useStore } from '../state/store';

/** Editable product table: SKU, name, dims, weight, quantity. */
export function ProductEditor({
  totalUnits,
  onImportClick,
  onExport,
}: {
  totalUnits: number;
  onImportClick: () => void;
  onExport: () => void;
}) {
  const { products, addProduct, updateProduct, removeProduct } = useStore();

  const setNum = (id: string, key: 'length' | 'width' | 'height' | 'weight' | 'quantity', v: string) => {
    const n = parseFloat(v);
    updateProduct(id, { [key]: Number.isFinite(n) ? n : 0 });
  };

  return (
    <div className="editor">
      <div className="editor-actions">
        <button className="btn btn-primary btn-sm" onClick={addProduct}>+ Product</button>
        <button className="btn btn-ghost btn-sm" onClick={onImportClick}>Import CSV</button>
        <button className="btn btn-ghost btn-sm" onClick={onExport}>Export</button>
      </div>
      <p className="muted small">
        {products.length} SKUs · {totalUnits} units total. Units are cm and kg.
      </p>

      <div className="table-scroll">
        <table className="table table-inputs">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>L</th>
              <th>W</th>
              <th>H</th>
              <th>kg</th>
              <th>Qty</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <input
                    value={p.sku}
                    onChange={(e) => updateProduct(p.id, { sku: e.target.value })}
                    aria-label={`SKU for ${p.name}`}
                  />
                </td>
                <td>
                  <input
                    value={p.name}
                    onChange={(e) => updateProduct(p.id, { name: e.target.value })}
                    aria-label={`Name for ${p.sku}`}
                  />
                </td>
                <td>
                  <input className="num" type="number" value={p.length}
                    onChange={(e) => setNum(p.id, 'length', e.target.value)}
                    aria-label={`Length of ${p.sku}`} />
                </td>
                <td>
                  <input className="num" type="number" value={p.width}
                    onChange={(e) => setNum(p.id, 'width', e.target.value)}
                    aria-label={`Width of ${p.sku}`} />
                </td>
                <td>
                  <input className="num" type="number" value={p.height}
                    onChange={(e) => setNum(p.id, 'height', e.target.value)}
                    aria-label={`Height of ${p.sku}`} />
                </td>
                <td>
                  <input className="num" type="number" step="0.01" value={p.weight}
                    onChange={(e) => setNum(p.id, 'weight', e.target.value)}
                    aria-label={`Weight of ${p.sku}`} />
                </td>
                <td>
                  <input className="num" type="number" value={p.quantity}
                    onChange={(e) => setNum(p.id, 'quantity', e.target.value)}
                    aria-label={`Quantity of ${p.sku}`} />
                </td>
                <td>
                  <button className="icon-btn" title={`Remove ${p.sku}`}
                    onClick={() => removeProduct(p.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && <p className="empty">No products yet. Add one or import a CSV.</p>}
      </div>
    </div>
  );
}