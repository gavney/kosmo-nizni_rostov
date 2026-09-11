from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field

from .metrics import (
    attach_visibility,
    clients_of,
    empty_series,
    summarize_metrics,
    visible_clients,
)
from .scenario import validate_payload
from .snapshot import enrich_snapshot
from .timegrid import time_grid


def scenario_hash(scenario: dict) -> str:
    blob = json.dumps(scenario, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:20]


@dataclass
class Simulation:
    sim_id: str
    scenario: dict
    times: list[int]
    snapshots: dict[int, dict] = field(default_factory=dict)
    series: dict[str, dict] = field(default_factory=dict)
    metrics: dict = field(default_factory=dict)
    routes: list[dict] = field(default_factory=list)


CACHE: dict[str, Simulation] = {}


def get_sim(sim_id: str) -> Simulation | None:
    return CACHE.get(sim_id)


def snapshot_at(scenario: dict, t_s: float, sim_id: str | None = None) -> dict:
    check = validate_payload(scenario)
    if not check["ok"]:
        raise ValueError(check["error"])
    if sim_id:
        sim = CACHE.get(sim_id)
        if sim is not None:
            key = int(t_s)
            if key in sim.snapshots:
                return sim.snapshots[key]
    return enrich_snapshot(scenario, t_s)


def simulate(scenario: dict) -> Simulation:
    check = validate_payload(scenario)
    if not check["ok"]:
        raise ValueError(check["error"])
    sim_id = scenario_hash(scenario)
    cached = CACHE.get(sim_id)
    if cached is not None:
        return cached
    times = time_grid(scenario)
    client_ids = [c["id"] for c in clients_of(scenario)]
    series = empty_series(client_ids)
    snapshots: dict[int, dict] = {}
    for t in times:
        snap = enrich_snapshot(scenario, t)
        snapshots[t] = snap
        attach_visibility(series, visible_clients(snap, scenario))
    step = int(scenario["environment"]["step_s"])
    metrics = summarize_metrics(scenario, series, step)
    sim = Simulation(
        sim_id=sim_id,
        scenario=scenario,
        times=times,
        snapshots=snapshots,
        series=series,
        metrics=metrics,
    )
    CACHE[sim_id] = sim
    if len(CACHE) > 12:
        oldest = next(iter(CACHE))
        if oldest != sim_id:
            CACHE.pop(oldest, None)
    return sim
