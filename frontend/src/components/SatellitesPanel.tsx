import type { Scenario, Snapshot } from "../types";

export default function SatellitesPanel({
  scenario,
  snapshot,
  selected,
  followed,
  routePath,
  start,
  end,
  onSelect,
  onFollow,
  onStart,
  onEnd,
  onFail,
  onClear,
}: {
  scenario: Scenario;
  snapshot: Snapshot | null;
  selected: string | null;
  followed: string | null;
  routePath: string[];
  start: number;
  end: number;
  onSelect: (id: string) => void;
  onFollow: (id: string | null) => void;
  onStart: (value: number) => void;
  onEnd: (value: number) => void;
  onFail: () => void;
  onClear: () => void;
}) {
  const failedNow = new Set(
    scenario.failures
      .filter((f) => snapshot && f.start_s <= snapshot.t_s && snapshot.t_s < f.end_s)
      .map((f) => f.satellite_id),
  );
  const onRoute = new Set(routePath);
  const selectedHasFailure = selected
    ? scenario.failures.some((f) => f.satellite_id === selected)
    : false;

  return (
    <div className="stack">
      <h2>Спутники</h2>
      <p className="lead">
        Жёлтым — в цепи передачи. Клик по КА на глобусе — камера летит за ним; повторный клик / «Снять
        слежение» — возврат к обзору. ПКМ / СКМ — сдвиг камеры (как pan в Blender).
      </p>
      <div className="sat-list">
        {scenario.design.satellites.map((sat) => {
          const live = snapshot?.satellites.find((s) => s.id === sat.id);
          const inactive = live ? !live.active : sat.launch_batch > scenario.design.launch_stage;
          const relay = onRoute.has(sat.id);
          return (
            <button
              key={sat.id}
              type="button"
              className={[
                "sat",
                selected === sat.id ? "active" : "",
                inactive ? "dim" : "",
                relay ? "on-route" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelect(sat.id)}
            >
              <b>{sat.id}</b>
              <span>
                {sat.plane_id} · партия {sat.launch_batch}
                {relay ? " · в цепи" : ""}
                {failedNow.has(sat.id) ? " · отказ" : ""}
              </span>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="outage-form">
          <p>Отказ {selected}</p>
          <label>
            начало, с
            <input type="number" value={start} onChange={(e) => onStart(Number(e.target.value))} />
          </label>
          <label>
            конец, с
            <input type="number" value={end} onChange={(e) => onEnd(Number(e.target.value))} />
          </label>
          <div className="actions">
            <button
              type="button"
              className={followed === selected ? "active" : ""}
              onClick={() => onFollow(followed === selected ? null : selected)}
            >
              {followed === selected ? "Отпустить камеру" : "Следить на глобусе"}
            </button>
            <button type="button" onClick={onFail}>
              Задать отказ
            </button>
            <button
              type="button"
              className="ghost"
              disabled={!selectedHasFailure}
              title={selectedHasFailure ? "Убрать отказ этого КА" : "Для этого КА отказ не задан"}
              onClick={onClear}
            >
              Снять отказ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
