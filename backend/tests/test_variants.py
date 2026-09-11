from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[2]
FULL = json.loads((ROOT / "fixtures" / "01_full_constellation.json").read_text(encoding="utf-8"))
FIRST = json.loads((ROOT / "fixtures" / "02_first_launch.json").read_text(encoding="utf-8"))


def test_save_and_compare_variants() -> None:
    a = client.post("/api/variants", json={"name": "Full", "scenario": FULL})
    b = client.post("/api/variants", json={"name": "First", "scenario": FIRST})
    assert a.status_code == 200
    assert b.status_code == 200
    cmp = client.post(
        "/api/compare",
        json={"left": FULL, "right": FIRST, "left_name": "Full", "right_name": "First"},
    )
    assert cmp.status_code == 200
    body = cmp.json()
    assert body["winner"] in {"left", "right", "tie"}
    assert "recommendations" in body
    assert body["diff"]["launch_stage"] == [3, 1]
    listed = client.get("/api/variants")
    assert len(listed.json()) >= 2
