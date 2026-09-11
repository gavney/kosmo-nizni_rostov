from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.engine import simulate
from app.main import app
from app.routing import find_route
from app.snapshot import enrich_snapshot

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[2]
FULL = json.loads((ROOT / "fixtures" / "01_full_constellation.json").read_text(encoding="utf-8"))
FIRST = json.loads((ROOT / "fixtures" / "02_first_launch.json").read_text(encoding="utf-8"))


def test_route_has_gateway() -> None:
    snap = enrich_snapshot(FULL, 0)
    route = find_route(FULL, snap, "C65", mode="bfs")
    assert route["path"][0] == "C65"
    assert route["path"][-1] == "G_MUR"
    assert route["hops"] >= 2
    assert route["delay_ms"] is not None


def test_first_launch_can_have_outage_reason() -> None:
    sim = simulate(FIRST, mode="bfs")
    reasons = set()
    for row in sim.series["C72"]["reason"]:
        if row:
            reasons.add(row)
    assert sim.metrics["clients"]["C65"]["availability"] <= 1
    assert reasons <= {
        "no_visible_satellite",
        "isl_disconnected",
        "no_gateway_contact",
        "gateway_offline",
    }


def test_export_schema() -> None:
    response = client.post("/api/export", json={"scenario": FULL, "mode": "bfs"})
    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == "cosmo-A-result-1.0"
    assert "effective_scenario" in body
    sample = next(item for item in body["routes"] if item["client_id"] == "C65" and item["t_s"] == 0)
    assert sample["path"][0] == "C65"
    assert sample["path"][-1] == "G_MUR"
    assert len(body["routes"]) == 720 * 3
