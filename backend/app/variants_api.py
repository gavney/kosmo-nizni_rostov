from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .engine import BusyError, simulate
from .variants import (
    compare_ids,
    compare_sims,
    delete_variant,
    get_variant,
    list_variants,
    raw_variant,
    save_variant,
)

router = APIRouter(tags=["variants"])


def _busy(exc: BusyError) -> HTTPException:
    return HTTPException(
        status_code=503,
        detail=str(exc),
        headers={"Retry-After": "5"},
    )

class SaveBody(BaseModel):
    name: str
    scenario: dict
    mode: str = "bfs"


class CompareIdsBody(BaseModel):
    left_id: str
    right_id: str


class CompareScenariosBody(BaseModel):
    left: dict
    right: dict
    left_name: str = "A"
    right_name: str = "B"
    mode: str = "bfs"


@router.post("/variants")
def post_variant(body: SaveBody) -> dict:
    try:
        return save_variant(body.name, body.scenario, mode=body.mode)
    except BusyError as exc:
        raise _busy(exc) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/variants")
def get_variants() -> list[dict]:
    return list_variants()


@router.get("/variants/{variant_id}")
def get_one_variant(variant_id: str) -> dict:
    item = get_variant(variant_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Variant not found")
    raw = raw_variant(variant_id)
    item["scenario"] = raw["scenario"] if raw else None
    return item


@router.delete("/variants/{variant_id}")
def remove_variant(variant_id: str) -> dict:
    if not delete_variant(variant_id):
        raise HTTPException(status_code=404, detail="Variant not found")
    return {"ok": True}


@router.post("/compare")
def post_compare(body: CompareScenariosBody) -> dict:
    try:
        left = simulate(body.left, mode=body.mode)
        right = simulate(body.right, mode=body.mode)
        return compare_sims(left, right, body.left_name, body.right_name)
    except BusyError as exc:
        raise _busy(exc) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/compare/ids")
def post_compare_ids(body: CompareIdsBody) -> dict:
    try:
        return compare_ids(body.left_id, body.right_id)
    except BusyError as exc:
        raise _busy(exc) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
