from __future__ import annotations

from copy import deepcopy


def set_launch_stage(scenario: dict, stage: int) -> dict:
    if stage not in (1, 2, 3):
        raise ValueError("launch_stage must be 1, 2 or 3")
    out = deepcopy(scenario)
    out["design"]["launch_stage"] = stage
    return out


def set_plane_angles(
    scenario: dict,
    plane_id: str,
    raan_deg: float | None = None,
    phase_deg: float | None = None,
) -> dict:
    out = deepcopy(scenario)
    found = False
    for plane in out["design"]["planes"]:
        if plane["id"] != plane_id:
            continue
        found = True
        if raan_deg is not None:
            plane["raan_deg"] = float(raan_deg) % 360
        if phase_deg is not None:
            plane["phase_deg"] = float(phase_deg) % 360
    if not found:
        raise ValueError(f"Unknown plane: {plane_id}")
    return out


def upsert_failure(scenario: dict, satellite_id: str, start_s: float, end_s: float) -> dict:
    out = deepcopy(scenario)
    ids = {sat["id"] for sat in out["design"]["satellites"]}
    if satellite_id not in ids:
        raise ValueError(f"Unknown satellite: {satellite_id}")
    horizon = out["environment"]["horizon_s"]
    if not 0 <= start_s < end_s <= horizon:
        raise ValueError("Invalid failure interval")
    others = [f for f in out.get("failures", []) if f["satellite_id"] != satellite_id]
    others.append({"satellite_id": satellite_id, "start_s": start_s, "end_s": end_s})
    out["failures"] = others
    return out


def clear_failure(scenario: dict, satellite_id: str) -> dict:
    out = deepcopy(scenario)
    out["failures"] = [f for f in out.get("failures", []) if f["satellite_id"] != satellite_id]
    return out


def upsert_gateway_outage(scenario: dict, gateway_id: str, start_s: float, end_s: float) -> dict:
    out = deepcopy(scenario)
    gids = {g["id"] for g in out["ground_sites"] if g["role"] == "gateway"}
    if gateway_id not in gids:
        raise ValueError(f"Unknown gateway: {gateway_id}")
    horizon = out["environment"]["horizon_s"]
    if not 0 <= start_s < end_s <= horizon:
        raise ValueError("Invalid gateway outage interval")
    others = [f for f in out.get("gateway_outages", []) if f["gateway_id"] != gateway_id]
    others.append({"gateway_id": gateway_id, "start_s": start_s, "end_s": end_s})
    out["gateway_outages"] = others
    return out


def clear_gateway_outage(scenario: dict, gateway_id: str) -> dict:
    out = deepcopy(scenario)
    out["gateway_outages"] = [
        f for f in out.get("gateway_outages", []) if f["gateway_id"] != gateway_id
    ]
    return out
