from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.mutate import set_launch_stage, set_plane_angles

client = TestClient(app)
FULL = json.loads(
    (Path(__file__).resolve().parents[2] / "fixtures" / "01_full_constellation.json").read_text(
        encoding="utf-8"
    )
)


def test_launch_stage_and_plane() -> None:
    staged = set_launch_stage(FULL, 1)
    assert staged["design"]["launch_stage"] == 1
    rotated = set_plane_angles(staged, "P2", raan_deg=75, phase_deg=10)
    plane = next(p for p in rotated["design"]["planes"] if p["id"] == "P2")
    assert plane["raan_deg"] == 75
    assert plane["phase_deg"] == 10


def test_failure_and_gateway_api() -> None:
    failed = client.post(
        "/api/scenarios/failure",
        json={"scenario": FULL, "satellite_id": "S01", "start_s": 100, "end_s": 500},
    )
    assert failed.status_code == 200
    assert failed.json()["failures"][0]["satellite_id"] == "S01"
    outage = client.post(
        "/api/scenarios/gateway-outage",
        json={"scenario": FULL, "gateway_id": "G_MUR", "start_s": 0, "end_s": 120},
    )
    assert outage.status_code == 200
    assert outage.json()["gateway_outages"][0]["gateway_id"] == "G_MUR"
    cleared = client.post(
        "/api/scenarios/failure",
        json={"scenario": failed.json(), "satellite_id": "S01", "start_s": 0, "end_s": 1, "clear": True},
    )
    assert cleared.json()["failures"] == []
