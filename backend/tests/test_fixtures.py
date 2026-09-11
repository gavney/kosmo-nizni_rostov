from __future__ import annotations

import json
from pathlib import Path

from app.engine import simulate
from app.export import export_result

ROOT = Path(__file__).resolve().parents[2] / "fixtures"


def _load(name: str) -> dict:
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def test_all_case_fixtures_simulate() -> None:
    names = [
        "01_full_constellation.json",
        "02_first_launch.json",
        "03_satellite_outages.json",
        "04_link_range.json",
    ]
    metrics = {}
    for name in names:
        scenario = _load(name)
        sim = simulate(scenario)
        assert sim.metrics["n_steps"] == 720
        assert set(sim.metrics["clients"]) == {"C65", "C70", "C72"}
        payload = export_result(sim.scenario, sim.routes)
        assert payload["schema_version"] == "cosmo-A-result-1.0"
        assert len(payload["routes"]) == 720 * 3
        metrics[name] = sim.metrics

    full = metrics["01_full_constellation.json"]
    first = metrics["02_first_launch.json"]
    assert first["clients"]["C72"]["availability"] <= full["clients"]["C72"]["availability"]
    outages = _load("03_satellite_outages.json")
    assert len(outages["failures"]) == 10
    link = _load("04_link_range.json")
    assert link["environment"]["isl_range_km"] == 2000
