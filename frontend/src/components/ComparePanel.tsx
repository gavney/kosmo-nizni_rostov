import type { CompareResult, VariantInfo } from "../types";
import { minutes, pct } from "../format";

const ENV_LABELS: Record<string, string> = {
  isl_range_km: "Дальность ISL",
  min_elevation_deg: "Мин. угол места",
  altitude_km: "Высота орбиты",
  target_availability: "Цель доступности",
};

function formatPair(a: unknown, b: unknown, unit = ""): string {
  const left = typeof a === "number" ? (Number.isInteger(a) ? String(a) : a.toFixed(1)) : String(a);
  const right = typeof b === "number" ? (Number.isInteger(b) ? String(b) : b.toFixed(1)) : String(b);
  return `${left}${unit} → ${right}${unit}`;
}

/** Human-readable A → B parameter changes from API `diff`. */
export function formatDesignDiff(diff: CompareResult["diff"]): string[] {
  const lines: string[] = [];
  const [stageA, stageB] = diff.launch_stage ?? [];
  if (stageA !== stageB) {
    lines.push(`Очередь запуска: ${formatPair(stageA, stageB)}`);
  }

  for (const plane of diff.planes ?? []) {
    const id = String(plane.id ?? "?");
    if (plane.change === "added") {
      lines.push(`${id}: плоскость добавлена`);
      continue;
    }
    if (plane.change === "removed") {
      lines.push(`${id}: плоскость удалена`);
      continue;
    }
    if (Array.isArray(plane.raan_deg)) {
      lines.push(`${id} RAAN: ${formatPair(plane.raan_deg[0], plane.raan_deg[1], "°")}`);
    }
    if (Array.isArray(plane.phase_deg)) {
      lines.push(`${id} фаза: ${formatPair(plane.phase_deg[0], plane.phase_deg[1], "°")}`);
    }
  }

  for (const [key, pair] of Object.entries(diff.environment ?? {})) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const label = ENV_LABELS[key] ?? key;
    const unit = key.endsWith("_km") ? " км" : key.endsWith("_deg") ? "°" : key === "target_availability" ? "" : "";
    if (key === "target_availability") {
      lines.push(`${label}: ${pct(Number(pair[0]))} → ${pct(Number(pair[1]))}`);
    } else {
      lines.push(`${label}: ${formatPair(pair[0], pair[1], unit)}`);
    }
  }

  const [failA, failB] = diff.failures ?? [];
  if (failA !== failB) {
    lines.push(`Отказы КА: ${formatPair(failA, failB)}`);
  }
  const [gwA, gwB] = diff.gateway_outages ?? [];
  if (gwA !== gwB) {
    lines.push(`Простои шлюза: ${formatPair(gwA, gwB)}`);
  }

  return lines;
}

export default function ComparePanel({
  variants,
  leftId,
  rightId,
  result,
  busy,
  onLeft,
  onRight,
  onRun,
  onLoad,
}: {
  variants: VariantInfo[];
  leftId: string;
  rightId: string;
  result: CompareResult | null;
  busy: boolean;
  onLeft: (id: string) => void;
  onRight: (id: string) => void;
  onRun: () => void;
  onLoad: (id: string) => void;
}) {
  const diffLines = result?.diff ? formatDesignDiff(result.diff) : [];

  return (
    <div className="stack">
      <h2>Сравнение</h2>
      <p className="lead">Сохраните два варианта и сопоставьте параметры, доступность и перерывы.</p>
      <label className="field">
        Вариант A
        <select value={leftId} onChange={(e) => onLeft(e.target.value)}>
          <option value="">—</option>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Вариант B
        <select value={rightId} onChange={(e) => onRight(e.target.value)}>
          <option value="">—</option>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <div className="actions">
        <button type="button" disabled={busy || !leftId || !rightId} onClick={onRun}>
          Сравнить
        </button>
        {leftId && (
          <button type="button" className="ghost" onClick={() => onLoad(leftId)}>
            Открыть A
          </button>
        )}
      </div>
      {result && (
        <div className="compare">
          <p className="winner">
            Лучше:{" "}
            {result.winner === "tie"
              ? "паритет"
              : result.winner === "left"
                ? result.left.name
                : result.right.name}
          </p>

          <div className="diff-box">
            <p className="diff-title">Что изменили A → B</p>
            {diffLines.length > 0 ? (
              <ul className="diff-list">
                {diffLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="hint">Конфиг одинаковый — отличаются только метрики или случайности расчёта.</p>
            )}
          </div>

          <p className="diff-title">Итоговые показатели</p>
          {Object.entries(result.clients).map(([id, row]) => (
            <div key={id} className="cmp-row">
              <b>{id}</b>
              <span>
                {pct(row.left.availability)} → {pct(row.right.availability)} (
                {row.availability_delta >= 0 ? "+" : ""}
                {(row.availability_delta * 100).toFixed(1)} п.п.)
              </span>
              <span>
                перерыв {minutes(row.left.max_outage_s)} / {minutes(row.right.max_outage_s)}
              </span>
            </div>
          ))}
          <ul>
            {result.recommendations.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
