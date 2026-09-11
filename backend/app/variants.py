from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .engine import Simulation, simulate
from .recommend import compare_payload, recommend

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "variants"
STORE: dict[str, dict] = {}


def _ensure_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def save_variant(name: str, scenario: dict, mode: str = "bfs") -> dict:
    sim = simulate(scenario, mode=mode)
    item = {
        "id": uuid.uuid4().hex[:12],
        "name": name,
        "mode": mode,
        "sim_id": sim.sim_id,
        "scenario": scenario,
        "metrics": sim.metrics,
        "recommendations": recommend(sim),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    STORE[item["id"]] = item
    _ensure_dir()
    (DATA_DIR / f"{item['id']}.json").write_text(
        json.dumps(item, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return _public(item)


def list_variants() -> list[dict]:
    return [_public(item) for item in STORE.values()]


def get_variant(variant_id: str) -> dict | None:
    item = STORE.get(variant_id)
    return _public(item) if item else None


def raw_variant(variant_id: str) -> dict | None:
    return STORE.get(variant_id)


def delete_variant(variant_id: str) -> bool:
    item = STORE.pop(variant_id, None)
    if item is None:
        return False
    path = DATA_DIR / f"{variant_id}.json"
    if path.exists():
        path.unlink()
    return True


def compare_ids(left_id: str, right_id: str) -> dict:
    left = STORE.get(left_id)
    right = STORE.get(right_id)
    if left is None or right is None:
        raise KeyError("Variant not found")
    left_sim = simulate(left["scenario"], mode=left.get("mode", "bfs"))
    right_sim = simulate(right["scenario"], mode=right.get("mode", "bfs"))
    payload = compare_payload(left_sim, right_sim)
    payload["left"] = _public(left)
    payload["right"] = _public(right)
    return payload


def compare_sims(left: Simulation, right: Simulation, left_name: str, right_name: str) -> dict:
    payload = compare_payload(left, right)
    payload["left"] = {"name": left_name, "sim_id": left.sim_id, "metrics": left.metrics}
    payload["right"] = {"name": right_name, "sim_id": right.sim_id, "metrics": right.metrics}
    return payload


def _public(item: dict) -> dict:
    return {
        "id": item["id"],
        "name": item["name"],
        "mode": item["mode"],
        "sim_id": item["sim_id"],
        "metrics": item["metrics"],
        "recommendations": item["recommendations"],
        "created_at": item["created_at"],
        "launch_stage": item["scenario"]["design"]["launch_stage"],
        "isl_range_km": item["scenario"]["environment"]["isl_range_km"],
        "n_failures": len(item["scenario"].get("failures", [])),
    }
