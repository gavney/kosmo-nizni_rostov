import type { RouteInfo, Scenario, Snapshot } from "../types";
import { reasonLabel } from "../format";

export default function GroundPanel({
  scenario,
  snapshot,
  clientId,
  route,
  start,
  end,
  onClient,
  onStart,
  onEnd,
  onOutage,
  onClear,
}: {
  scenario: Scenario;
  snapshot: Snapshot | null;
  clientId: string;
  route: RouteInfo | undefined;
  start: number;
  end: number;
  onClient: (id: string) => void;
  onStart: (value: number) => void;
  onEnd: (value: number) => void;
  onOutage: (gatewayId: string) => void;
  onClear: (gatewayId: string) => void;
}) {
  return (
    <div className="stack">
      <h2>Земля</h2>
      <p className="lead">Клиенты не ретранслируют трафик. Маршрут всегда заканчивается в шлюзе.</p>
      {scenario.ground_sites.map((site) => (
        <button
          key={site.id}
          type="button"
          className={`site ${site.id === clientId ? "active" : ""}`}
          onClick={() => site.role === "client" && onClient(site.id)}
        >
          <b>{site.id}</b>
          <span>
            {site.role} · {site.lat_deg.toFixed(2)}° / {site.lon_deg.toFixed(2)}°
          </span>
        </button>
      ))}
      <div className="route-box">
        <p>{route?.path.length ? route.path.join(" → ") : reasonLabel(route?.reason ?? "no_visible_satellite")}</p>
        {route?.delay_ms != null && <p>задержка {route.delay_ms.toFixed(1)} мс · {route.hops} hops</p>}
      </div>
      {scenario.ground_sites
        .filter((s) => s.role === "gateway")
        .map((gw) => (
          <div key={gw.id} className="outage-form">
            <p>Недоступность шлюза {gw.id}</p>
            <label>
              начало, с
              <input type="number" value={start} onChange={(e) => onStart(Number(e.target.value))} />
            </label>
            <label>
              конец, с
              <input type="number" value={end} onChange={(e) => onEnd(Number(e.target.value))} />
            </label>
            <div className="actions">
              <button type="button" onClick={() => onOutage(gw.id)}>
                Отключить шлюз
              </button>
              <button type="button" className="ghost" onClick={() => onClear(gw.id)}>
                Снять
              </button>
            </div>
          </div>
        ))}
      {snapshot && (
        <p className="hint">t = {snapshot.t_s} с</p>
      )}
    </div>
  );
}
