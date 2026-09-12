export type GlobeLayers = {
  isl: boolean;
  orbits: boolean;
  coverage: boolean;
  critical: boolean;
  labels: boolean;
  backup: boolean;
};

export const DEFAULT_GLOBE_LAYERS: GlobeLayers = {
  isl: true,
  orbits: true,
  coverage: true,
  critical: true,
  labels: true,
  backup: false,
};

const TOGGLES: { key: keyof GlobeLayers; label: string }[] = [
  { key: "isl", label: "ISL" },
  { key: "orbits", label: "Орбиты" },
  { key: "coverage", label: "Ореолы" },
  { key: "critical", label: "Критичные" },
  { key: "labels", label: "Подписи" },
  { key: "backup", label: "Резервный путь" },
];

export default function LayerPanel({
  layers,
  onChange,
  raised = false,
}: {
  layers: GlobeLayers;
  onChange: (next: GlobeLayers) => void;
  raised?: boolean;
}) {
  return (
    <aside className={`layer-panel glass ${raised ? "raised" : ""}`} aria-label="Слои глобуса">
      <p className="layer-panel-title">Слои</p>
      <div className="layer-toggles">
        {TOGGLES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={layers[key] ? "on" : ""}
            aria-pressed={layers[key]}
            onClick={() => onChange({ ...layers, [key]: !layers[key] })}
          >
            {label}
          </button>
        ))}
      </div>
    </aside>
  );
}
