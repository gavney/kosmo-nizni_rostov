from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures"

router = APIRouter(tags=["fixtures"])


def list_fixture_files() -> list[Path]:
    return sorted(FIXTURES_DIR.glob("*.json"))


@router.get("/fixtures")
def list_fixtures() -> list[dict]:
    items = []
    for path in list_fixture_files():
        data = json.loads(path.read_text(encoding="utf-8"))
        meta = data.get("meta", {})
        items.append(
            {
                "id": meta.get("id", path.stem),
                "title": meta.get("title", path.stem),
                "filename": path.name,
            }
        )
    return items


@router.get("/fixtures/{fixture_id}")
def get_fixture(fixture_id: str) -> dict:
    for path in list_fixture_files():
        data = json.loads(path.read_text(encoding="utf-8"))
        if path.stem == fixture_id or data.get("meta", {}).get("id") == fixture_id:
            return data
    raise HTTPException(status_code=404, detail="Fixture not found")
