from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .engine import export_simulation, get_sim, simulate, snapshot_at
from .routing import find_route
from .scenario import validate_payload

router = APIRouter(tags=["calc"])


class ScenarioBody(BaseModel):
    scenario: dict
    t_s: float = 0
    sim_id: str | None = None
    client_id: str | None = None
    mode: str = "bfs"


class SimulateBody(BaseModel):
    scenario: dict = Field(...)
    mode: str = "bfs"


def _public_series(series: dict[str, dict]) -> dict[str, dict]:
    out = {}
    for cid, data in series.items():
        out[cid] = {
            "visible": data["visible"],
            "reachable": data["reachable"],
            "hops": data["hops"],
            "reason": data["reason"],
            "delay_ms": data["delay_ms"],
        }
    return out


@router.post("/scenarios/validate")
def validate_scenario(body: ScenarioBody) -> dict:
    return validate_payload(body.scenario)


@router.post("/snapshot")
def post_snapshot(body: ScenarioBody) -> dict:
    try:
        snap = snapshot_at(body.scenario, body.t_s, body.sim_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    routes = []
    if body.client_id:
        routes.append(find_route(body.scenario, snap, body.client_id, mode=body.mode))
    else:
        for site in body.scenario["ground_sites"]:
            if site["role"] == "client":
                routes.append(find_route(body.scenario, snap, site["id"], mode=body.mode))
    snap = dict(snap)
    snap["routes"] = routes
    return snap


@router.post("/route")
def post_route(body: ScenarioBody) -> dict:
    if not body.client_id:
        raise HTTPException(status_code=400, detail="client_id required")
    try:
        snap = snapshot_at(body.scenario, body.t_s, body.sim_id)
        return find_route(body.scenario, snap, body.client_id, mode=body.mode)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/simulate")
def post_simulate(body: SimulateBody) -> dict:
    try:
        sim = simulate(body.scenario, mode=body.mode)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "sim_id": sim.sim_id,
        "mode": sim.mode,
        "times": sim.times,
        "metrics": sim.metrics,
        "series": _public_series(sim.series),
        "n_snapshots": len(sim.snapshots),
    }


@router.get("/simulate/{sim_id}")
def get_simulation(sim_id: str) -> dict:
    sim = get_sim(sim_id)
    if sim is None:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {
        "sim_id": sim.sim_id,
        "mode": sim.mode,
        "times": sim.times,
        "metrics": sim.metrics,
        "series": _public_series(sim.series),
    }


@router.post("/export")
def post_export(body: SimulateBody) -> dict:
    try:
        sim = simulate(body.scenario, mode=body.mode)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return export_simulation(sim)


@router.get("/export/{sim_id}")
def get_export(sim_id: str) -> dict:
    sim = get_sim(sim_id)
    if sim is None:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return export_simulation(sim)
