import { useStore } from '../state/store';

/** Optimization knobs. All affect the deterministic engine's behaviour. */
export function SettingsPanel() {
  const { settings, setSettings, runOptimization } = useStore();

  const update = (patch: Partial<typeof settings>) => setSettings({ ...settings, ...patch });

  return (
    <div className="editor settings">
      <label className="field">
        <span className="field-label">
          Allow item rotation
          <span className="muted small"> — try all 6 axis alignments</span>
        </span>
        <input
          type="checkbox"
          checked={settings.allowRotation}
          onChange={(e) => update({ allowRotation: e.target.checked })}
        />
      </label>

      <label className="field">
        <span className="field-label">
          Weight limit usage
          <span className="muted small"> — fraction of each box's max gross weight</span>
        </span>
        <input
          type="range"
          min={0.3}
          max={1}
          step={0.05}
          value={settings.weightUtilizationLimit}
          onChange={(e) => update({ weightUtilizationLimit: parseFloat(e.target.value) })}
        />
        <span className="field-value">{(settings.weightUtilizationLimit * 100).toFixed(0)}%</span>
      </label>

      <label className="field">
        <span className="field-label">
          Search depth
          <span className="muted small"> — more candidate orderings, slower but denser</span>
        </span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={settings.searchDepth}
          onChange={(e) => update({ searchDepth: parseInt(e.target.value, 10) })}
        />
        <span className="field-value">{settings.searchDepth}</span>
      </label>

      <label className="field">
        <span className="field-label">
          Volumetric shipping rate
          <span className="muted small"> — cost per m³ of box volume</span>
        </span>
        <input
          type="number"
          step={0.5}
          min={0}
          value={settings.shippingCostPerM3}
          onChange={(e) => update({ shippingCostPerM3: parseFloat(e.target.value) || 0 })}
        />
        <span className="field-value">${settings.shippingCostPerM3.toFixed(2)} / m³</span>
      </label>

      <button className="btn btn-primary" onClick={runOptimization}>Re-run with these settings</button>

      <div className="alert alert-info">
        <strong>Deterministic engine.</strong>
        <p>
          The optimizer uses no randomness: the same inputs always produce the same plan,
          which makes results reproducible and safe to audit.
        </p>
      </div>
    </div>
  );
}