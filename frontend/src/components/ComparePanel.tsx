import type { CompareResult, VariantInfo } from "../types";
import { minutes, pct } from "../format";

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
  return (
    <div className="stack">
      <h2>Сравнение</h2>
      <p className="lead">Сохраните два варианта и сопоставьте доступность.</p>
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
            Лучше: {result.winner === "tie" ? "паритет" : result.winner === "left" ? result.left.name : result.right.name}
          </p>
          {Object.entries(result.clients).map(([id, row]) => (
            <div key={id} className="cmp-row">
              <b>{id}</b>
              <span>
                {pct(row.left.availability)} → {pct(row.right.availability)} ({row.availability_delta >= 0 ? "+" : ""}
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
