import type { Scenario } from "../types";
import { StagePills } from "./Metrics";

export default function ProjectPanel({
  scenario,
  fixtures,
  onLoadFixture,
  onUpload,
  onStage,
  onPlane,
  onSave,
  onExport,
  onReset,
  busy,
}: {
  scenario: Scenario;
  fixtures: { id: string; title: string }[];
  onLoadFixture: (id: string) => void;
  onUpload: (file: File) => void;
  onStage: (stage: number) => void;
  onPlane: (id: string, key: "raan_deg" | "phase_deg", value: number) => void;
  onSave: () => void;
  onExport: () => void;
  onReset: () => void;
  busy: boolean;
}) {
  return (
    <div className="stack">
      <h2>Проект</h2>
      <p className="lead">{scenario.meta.title}</p>
      <label className="field">
        Сценарий
        <select
          value={scenario.meta.id}
          onChange={(e) => onLoadFixture(e.target.value)}
        >
          {fixtures.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Загрузить JSON
        <input
          type="file"
          accept="application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
      </label>
      <StagePills scenario={scenario} onChange={onStage} />
      {scenario.design.planes.map((plane) => (
        <div key={plane.id} className="plane">
          <strong>{plane.id}</strong>
          <label>
            RAAN {plane.raan_deg.toFixed(1)}°
            <input
              type="range"
              min={0}
              max={359.5}
              step={0.5}
              value={plane.raan_deg}
              onChange={(e) => onPlane(plane.id, "raan_deg", Number(e.target.value))}
            />
          </label>
          <label>
            фаза {plane.phase_deg.toFixed(1)}°
            <input
              type="range"
              min={0}
              max={359.5}
              step={0.5}
              value={plane.phase_deg}
              onChange={(e) => onPlane(plane.id, "phase_deg", Number(e.target.value))}
            />
          </label>
        </div>
      ))}
      <p className="hint">
        ISL {scenario.environment.isl_range_km} км · угол {scenario.environment.min_elevation_deg}° · цель{" "}
        {Math.round(scenario.environment.target_availability * 100)}%
      </p>
      <div className="actions">
        <button type="button" disabled={busy} onClick={onSave}>
          Сохранить вариант
        </button>
        <button type="button" disabled={busy} onClick={onExport}>
          Выгрузить результат
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={onReset}>
          Сброс
        </button>
      </div>
    </div>
  );
}
