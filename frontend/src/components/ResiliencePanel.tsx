import type { ClientResilience, Simulation } from "../types";
import { pct } from "../format";

export default function ResiliencePanel({
  sim,
  clientId,
  showAll,
  hasBackupNow,
  backupPath,
  spofNow,
}: {
  sim: Simulation;
  clientId: string;
  showAll: boolean;
  hasBackupNow: boolean;
  backupPath: string[];
  spofNow: string[];
}) {
  const ids = showAll ? Object.keys(sim.metrics.clients) : [clientId];
  return (
    <div className="resilience-box">
      <p className="resilience-title">Резервирование</p>
      <p className="hint">
        Золотой — рабочий путь, пунктир — запасной без КА первого. Нет пунктира — шаг на одном маршруте.
      </p>
      {!showAll && (
        <p className={`resilience-now ${hasBackupNow ? "ok" : backupPath.length === 0 && spofNow.length ? "warn" : ""}`}>
          {hasBackupNow
            ? `Сейчас есть запасной: ${backupPath.join(" → ")}`
            : spofNow.length
              ? `Сейчас без резерва · SPOF: ${spofNow.join(", ")}`
              : "Сейчас без резервного пути"}
        </p>
      )}
      {ids.map((id) => {
        const row = sim.metrics.resilience?.[id];
        if (!row) return null;
        return <ClientResilienceCard key={id} id={id} row={row} />;
      })}
    </div>
  );
}

function ClientResilienceCard({ id, row }: { id: string; row: ClientResilience }) {
  return (
    <div className="resilience-card">
      <div className="metric-head">
        <span>{id}</span>
        <b>{pct(row.backup_share)} с резервом</b>
      </div>
      <p className="metric-meta">
        второй путь {row.backup_steps} шагов · один путь {row.single_path_steps} шагов (
        {pct(row.single_path_share)})
      </p>
      {row.spof_top.length > 0 ? (
        <ul className="spof-list">
          {row.spof_top.map((item) => (
            <li key={item.satellite_id}>
              <b>{item.satellite_id}</b>
              <span>
                SPOF {pct(item.spof_share)} · если выключить → {pct(item.availability_if_failed)} (
                {item.availability_delta >= 0 ? "+" : ""}
                {(item.availability_delta * 100).toFixed(1)} п.п.)
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="metric-meta">Единственных точек отказа почти нет.</p>
      )}
    </div>
  );
}
