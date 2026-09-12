from __future__ import annotations

from collections import Counter


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
            "has_backup": [],
            "spof": [],
        }
    return series


def summarize_metrics(scenario: dict, series: dict[str, dict], step_s: int) -> dict:
    target = scenario["environment"]["target_availability"]
    metrics = {}
    resilience: dict[str, dict] = {}
    n_steps = None
    for cid, data in series.items():
        visible = data["visible"]
        reachable = data["reachable"] or visible
        n_steps = len(visible)
        vis_n = sum(1 for x in visible if x)
        reach_n = sum(1 for x in reachable if x)
        avail = reach_n / n_steps if n_steps else 0.0
        metrics[cid] = {
            "visibility": vis_n / n_steps if n_steps else 0.0,
            "availability": avail,
            "max_outage_s": max_gap_seconds(reachable if data["reachable"] else visible, step_s),
            "meets_target": avail >= target,
            "n_visible_steps": vis_n,
            "n_reachable_steps": reach_n,
            "n_steps": n_steps,
        }
        resilience[cid] = summarize_resilience(data, n_steps or 0, avail)
    return {
        "n_steps": n_steps or 0,
        "target_availability": target,
        "clients": metrics,
        "resilience": resilience,
    }


def summarize_resilience(data: dict, n_steps: int, availability: float) -> dict:
    has_backup = data.get("has_backup") or []
    reachable = data.get("reachable") or []
    backup_n = sum(1 for flag in has_backup if flag)
    single_n = sum(1 for ok, bak in zip(reachable, has_backup) if ok and not bak)
    reach_n = sum(1 for x in reachable if x)
    counts: Counter[str] = Counter()
    for row in data.get("spof") or []:
        for sid in row:
            counts[sid] += 1
    top = []
    for sid, steps in counts.most_common(5):
        # Exact if S always failed: lose every step where S was SPOF.
        avail_if_failed = max(0.0, (reach_n - steps) / n_steps) if n_steps else 0.0
        top.append(
            {
                "satellite_id": sid,
                "spof_steps": steps,
                "spof_share": steps / n_steps if n_steps else 0.0,
                "availability_if_failed": avail_if_failed,
                "availability_delta": avail_if_failed - availability,
            }
        )
    return {
        "backup_share": backup_n / n_steps if n_steps else 0.0,
        "backup_steps": backup_n,
        "single_path_share": single_n / n_steps if n_steps else 0.0,
        "single_path_steps": single_n,
        "spof_top": top,
    }


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
