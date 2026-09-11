from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .engine import get_sim, simulate, snapshot_at
from .scenario import validate_payload

router = APIRouter(tags=["calc"])


class ScenarioBody(BaseModel):
    scenario: dict
    t_s: float = 0
    sim_id: str | None = None


class SimulateBody(BaseModel):
    scenario: dict = Field(...)


@router.post("/scenarios/validate")
def validate_scenario(body: ScenarioBody) -> dict:
    return validate_payload(body.scenario)


@router.post("/snapshot")
def post_snapshot(body: ScenarioBody) -> dict:
    try:
        return snapshot_at(body.scenario, body.t_s, body.sim_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/simulate")
def post_simulate(body: SimulateBody) -> dict:
    try:
        sim = simulate(body.scenario)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "sim_id": sim.sim_id,
        "times": sim.times,
        "metrics": sim.metrics,
        "series": {cid: {"visible": data["visible"]} for cid, data in sim.series.items()},
        "n_snapshots": len(sim.snapshots),
    }


@router.get("/simulate/{sim_id}")
def get_simulation(sim_id: str) -> dict:
    sim = get_sim(sim_id)
    if sim is None:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {
        "sim_id": sim.sim_id,
        "times": sim.times,
        "metrics": sim.metrics,
        "series": sim.series,
    }
