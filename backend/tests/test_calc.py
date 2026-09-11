from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.engine import simulate
from app.geometry import load, snapshot
from app.main import app
from app.timegrid import time_grid

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[2]
FULL = ROOT / "fixtures" / "01_full_constellation.json"


def test_validate_ok() -> None:
    scenario = json.loads(FULL.read_text(encoding="utf-8"))
    response = client.post("/api/scenarios/validate", json={"scenario": scenario})
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_validate_bad_schema() -> None:
    response = client.post("/api/scenarios/validate", json={"scenario": {"schema_version": "nope"}})
    assert response.status_code == 200
    assert response.json()["ok"] is False


def test_snapshot_matches_geometry() -> None:
    scenario = json.loads(FULL.read_text(encoding="utf-8"))
    response = client.post("/api/snapshot", json={"scenario": scenario, "t_s": 0})
    assert response.status_code == 200
    body = response.json()
    raw = snapshot(scenario, 0)
    assert body["t_s"] == 0
    assert len(body["satellites"]) == len(raw["satellites"])
    assert len(body["edges"]) == len(raw["edges"])
    assert "sun_ecef" in body


def test_time_grid_excludes_horizon() -> None:
    scenario = load(FULL)
    times = time_grid(scenario)
    assert times[0] == 0
    assert times[-1] == scenario["environment"]["horizon_s"] - scenario["environment"]["step_s"]
    assert len(times) == scenario["environment"]["horizon_s"] // scenario["environment"]["step_s"]


def test_simulate_visibility_metrics() -> None:
    scenario = json.loads(FULL.read_text(encoding="utf-8"))
    sim = simulate(scenario)
    assert sim.metrics["n_steps"] == 720
    for cid, row in sim.metrics["clients"].items():
        assert 0 <= row["visibility"] <= 1
        assert row["n_steps"] == 720
        assert cid in {"C65", "C70", "C72"}
        assert row["max_outage_s"] >= 0
