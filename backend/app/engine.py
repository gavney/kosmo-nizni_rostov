from __future__ import annotations

import hashlib
import json
from collections import OrderedDict
from dataclasses import dataclass, field

from .export import export_result
from .geometry import snapshot as geometry_snapshot
from .metrics import (
    attach_visibility,
    clients_of,
    empty_series,
    summarize_metrics,
    visible_clients,
)
from .routing import find_route
from .scenario import validate_payload
from .snapshot import enrich_snapshot
from .timegrid import time_grid

# Keep few full sims; each still holds series + routes for export.
MAX_CACHED_SIMS = 4
# Playback frames only — do not store all 720 enriched snapshots.
MAX_FRAME_CACHE = 32


def scenario_hash(scenario: dict, mode: str = "bfs") -> str:
    blob = json.dumps(
        {"mode": mode, "scenario": scenario},
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:20]


@dataclass
class Simulation:
    sim_id: str
    scenario: dict
    times: list[int]
    mode: str = "bfs"
    # Small LRU of enriched UI frames (t_s -> snapshot). Empty after simulate.
    snapshots: OrderedDict[int, dict] = field(default_factory=OrderedDict)
    series: dict[str, dict] = field(default_factory=dict)
    metrics: dict = field(default_factory=dict)
    routes: list[dict] = field(default_factory=list)

    def remember_frame(self, t_s: int, snap: dict) -> dict:
        self.snapshots[t_s] = snap
        self.snapshots.move_to_end(t_s)
        while len(self.snapshots) > MAX_FRAME_CACHE:
            self.snapshots.popitem(last=False)
        return snap


CACHE: OrderedDict[str, Simulation] = OrderedDict()


def get_sim(sim_id: str) -> Simulation | None:
    sim = CACHE.get(sim_id)
    if sim is not None:
        CACHE.move_to_end(sim_id)
    return sim


def _put_sim(sim: Simulation) -> Simulation:
    CACHE[sim.sim_id] = sim
    CACHE.move_to_end(sim.sim_id)
    while len(CACHE) > MAX_CACHED_SIMS:
        CACHE.popitem(last=False)
    return sim


def snapshot_at(scenario: dict, t_s: float, sim_id: str | None = None) -> dict:
    check = validate_payload(scenario)
    if not check["ok"]:
        raise ValueError(check["error"])
    key = int(t_s)
    if sim_id:
        sim = get_sim(sim_id)
        if sim is not None:
            cached = sim.snapshots.get(key)
            if cached is not None:
                sim.snapshots.move_to_end(key)
                return cached
            return sim.remember_frame(key, enrich_snapshot(scenario, t_s))
    return enrich_snapshot(scenario, t_s)


def simulate(scenario: dict, mode: str = "bfs") -> Simulation:
    check = validate_payload(scenario)
    if not check["ok"]:
        raise ValueError(check["error"])
    if mode not in {"bfs", "dijkstra"}:
        raise ValueError("mode must be bfs or dijkstra")
    sim_id = scenario_hash(scenario, mode)
    cached = get_sim(sim_id)
    if cached is not None:
        return cached
    times = time_grid(scenario)
    client_ids = [c["id"] for c in clients_of(scenario)]
    series = empty_series(client_ids)
    routes: list[dict] = []
    # Bare geometry only — no sun/ground enrich on the hot path.
    for t in times:
        snap = geometry_snapshot(scenario, t)
        visible = visible_clients(snap, scenario)
        attach_visibility(series, visible)
        for cid in client_ids:
            route = find_route(scenario, snap, cid, mode=mode)
            routes.append(route)
            reachable = bool(route["path"])
            series[cid]["reachable"].append(reachable)
            series[cid]["hops"].append(route["hops"])
            series[cid]["reason"].append(route["reason"])
            series[cid]["delay_ms"].append(route["delay_ms"])
    step = int(scenario["environment"]["step_s"])
    metrics = summarize_metrics(scenario, series, step)
    sim = Simulation(
        sim_id=sim_id,
        scenario=scenario,
        times=times,
        mode=mode,
        snapshots=OrderedDict(),
        series=series,
        metrics=metrics,
        routes=routes,
    )
    return _put_sim(sim)


def export_simulation(sim: Simulation) -> dict:
    return export_result(sim.scenario, sim.routes)
