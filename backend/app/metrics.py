from __future__ import annotations

def clients_of(scenario: dict) -> list[dict]:
    return [g for g in scenario["ground_sites"] if g["role"] == "client"]


def gateways_of(scenario: dict) -> list[dict]:
    return [g for g in scenario["ground_sites"] if g["role"] == "gateway"]


def visible_clients(snapshot: dict, scenario: dict) -> dict[str, bool]:
    min_el = scenario["environment"]["min_elevation_deg"]
    result: dict[str, bool] = {}
    for client in clients_of(scenario):
        elevations = snapshot["elevation_deg"].get(client["id"], {})
        result[client["id"]] = any(el >= min_el for el in elevations.values())
    return result


def empty_series(client_ids: list[str]) -> dict[str, dict]:
    series = {}
    for cid in client_ids:
        series[cid] = {
            "visible": [],
            "reachable": [],
            "hops": [],
            "reason": [],
            "delay_ms": [],
        }
    return series


def summarize_metrics(scenario: dict, series: dict[str, dict], step_s: int) -> dict[str, dict]:
    target = scenario["environment"]["target_availability"]
    metrics = {}
    n_steps = None
    for cid, data in series.items():
        visible = data["visible"]
        reachable = data["reachable"] or visible
        n_steps = len(visible)
        vis_n = sum(1 for x in visible if x)
        reach_n = sum(1 for x in reachable if x)
        metrics[cid] = {
            "visibility": vis_n / n_steps if n_steps else 0.0,
            "availability": reach_n / n_steps if n_steps else 0.0,
            "max_outage_s": max_gap_seconds(reachable if data["reachable"] else visible, step_s),
            "meets_target": (reach_n / n_steps if n_steps else 0.0) >= target,
            "n_visible_steps": vis_n,
            "n_reachable_steps": reach_n,
            "n_steps": n_steps,
        }
    return {"n_steps": n_steps or 0, "target_availability": target, "clients": metrics}


def max_gap_seconds(flags: list[bool], step_s: int) -> int:
    longest = 0
    current = 0
    for ok in flags:
        if ok:
            longest = max(longest, current)
            current = 0
        else:
            current += 1
    longest = max(longest, current)
    return longest * step_s


def attach_visibility(series: dict[str, dict], visible: dict[str, bool]) -> None:
    for cid, flag in visible.items():
        series[cid]["visible"].append(bool(flag))
