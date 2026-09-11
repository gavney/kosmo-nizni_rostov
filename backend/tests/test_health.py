from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_fixtures_exist() -> None:
    root = Path(__file__).resolve().parents[2]
    names = {p.name for p in (root / "fixtures").glob("*.json")}
    assert {
        "01_full_constellation.json",
        "02_first_launch.json",
        "03_satellite_outages.json",
        "04_link_range.json",
    } <= names
