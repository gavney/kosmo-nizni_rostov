import type { ClientMetrics, Scenario, Simulation } from "../types";
import { minutes, pct } from "../format";

/** Stable palette for multi-route overlay on the globe. */
export const CLIENT_ROUTE_COLORS = ["#5ac8fa", "#ff9f0a", "#32d74b", "#ff453a", "#bf5af2"];

export function clientRouteColor(clientId: string, orderedIds: string[]): string {
  const i = Math.max(0, orderedIds.indexOf(clientId));
  return CLIENT_ROUTE_COLORS[i % CLIENT_ROUTE_COLORS.length];
}

export function MetricRow({
  id,
  row,
  active,
  color,
  onClick,
}: {
  id: string;
  row: ClientMetrics;
  active?: boolean;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={`metric ${active ? "active" : ""}`} onClick={onClick}>
      <div className="metric-head">
        <span className="metric-id">
          {color ? <i className="metric-swatch" style={{ background: color }} /> : null}
          {id}
        </span>
        <b className={row.meets_target ? "good" : "bad"}>{pct(row.availability)}</b>
      </div>
      <div className="bar">
        <i style={{ width: pct(row.availability), background: color ?? undefined }} />
      </div>
      <div className="metric-meta">
        видимость {pct(row.visibility)} · max {minutes(row.max_outage_s)}
      </div>
    </button>
  );
}

export function MetricsList({
  sim,
  clientId,
  showAll,
  onSelect,
  onSelectAll,
}: {
  sim: Simulation;
  clientId: string;
  showAll: boolean;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
}) {
  const ids = Object.keys(sim.metrics.clients);
  return (
    <div className="metrics">
      <button type="button" className={`metric metric-all ${showAll ? "active" : ""}`} onClick={onSelectAll}>
        <div className="metric-head">
          <span className="metric-id">Все клиенты</span>
        </div>
        <div className="metric-swatches">
          {ids.map((id) => (
            <i key={id} className="metric-swatch" style={{ background: clientRouteColor(id, ids) }} title={id} />
          ))}
        </div>
      </button>
      {Object.entries(sim.metrics.clients).map(([id, row]) => (
        <MetricRow
          key={id}
          id={id}
          row={row}
          active={!showAll && id === clientId}
          color={clientRouteColor(id, ids)}
          onClick={() => onSelect(id)}
        />
      ))}
    </div>
  );
}

export function StagePills({
  scenario,
  onChange,
}: {
  scenario: Scenario;
  onChange: (stage: number) => void;
}) {
  return (
    <div className="pills">
      {[1, 2, 3].map((stage) => (
        <button
          key={stage}
          type="button"
          className={scenario.design.launch_stage === stage ? "active" : ""}
          onClick={() => onChange(stage)}
        >
          очередь {stage}
        </button>
      ))}
    </div>
  );
}
