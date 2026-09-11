from __future__ import annotations

from .geometry import validate


def validate_payload(scenario: dict) -> dict:
    try:
        if not isinstance(scenario, dict):
            return {"ok": False, "error": "Scenario must be a JSON object", "field": None}
        validate(scenario)
        return {"ok": True, "error": None, "field": None}
    except KeyError as exc:
        field = str(exc).strip("'")
        return {"ok": False, "error": f"Missing field: {field}", "field": field}
    except (TypeError, ValueError) as exc:
        return {"ok": False, "error": str(exc), "field": None}
