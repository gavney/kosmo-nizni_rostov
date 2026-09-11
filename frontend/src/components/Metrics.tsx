import type { ClientMetrics, Scenario, Simulation } from "../types";
import { minutes, pct } from "../format";

export function MetricRow({
  id,
  row,
  active,
  onClick,
}: {
  id: string;
  row: ClientMetrics;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={`metric ${active ? "active" : ""}`} onClick={onClick}>
      <div className="metric-head">
        <span>{id}</span>
        <b className={row.meets_target ? "good" : "bad"}>{pct(row.availability)}</b>
      </div>
      <div className="bar">
        <i style={{ width: pct(row.availability) }} />
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
  onSelect,
}: {
  sim: Simulation;
  clientId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="metrics">
      {Object.entries(sim.metrics.clients).map(([id, row]) => (
        <MetricRow key={id} id={id} row={row} active={id === clientId} onClick={() => onSelect(id)} />
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
