from __future__ import annotations

from collections import Counter

from .routing import satellite_ids


def plane_map(scenario: dict) -> dict[str, dict]:
    return {p["id"]: p for p in scenario["design"]["planes"]}


def design_diff(left: dict, right: dict) -> dict:
    lp, rp = plane_map(left), plane_map(right)
    planes = []
    for pid in sorted(set(lp) | set(rp)):
        a, b = lp.get(pid), rp.get(pid)
        if not a or not b:
            planes.append({"id": pid, "change": "added" if b and not a else "removed"})
            continue
        entry = {"id": pid}
        if a["raan_deg"] != b["raan_deg"]:
            entry["raan_deg"] = [a["raan_deg"], b["raan_deg"]]
        if a["phase_deg"] != b["phase_deg"]:
            entry["phase_deg"] = [a["phase_deg"], b["phase_deg"]]
        if len(entry) > 1:
            planes.append(entry)
    env_keys = ["isl_range_km", "min_elevation_deg", "altitude_km", "target_availability"]
    env = {
        key: [left["environment"][key], right["environment"][key]]
        for key in env_keys
        if left["environment"].get(key) != right["environment"].get(key)
    }
    return {
        "launch_stage": [left["design"]["launch_stage"], right["design"]["launch_stage"]],
        "planes": planes,
        "environment": env,
        "failures": [len(left.get("failures", [])), len(right.get("failures", []))],
        "gateway_outages": [
            len(left.get("gateway_outages", [])),
            len(right.get("gateway_outages", [])),
        ],
    }


def path_hotspots(sim) -> list[dict]:
    sats = satellite_ids(sim.scenario)
    counts: Counter[str] = Counter()
    for route in sim.routes:
        for node in route.get("path") or []:
            if node in sats:
                counts[node] += 1
    n = max(len(sim.routes), 1)
    return [
        {"satellite_id": sid, "on_route_share": count / n, "on_route_steps": count}
        for sid, count in counts.most_common(8)
    ]


def recommend(sim, other=None) -> list[str]:
    notes: list[str] = []
    target = sim.metrics["target_availability"]
    stage = sim.scenario["design"]["launch_stage"]
    isl = sim.scenario["environment"]["isl_range_km"]
    failing = []
    for cid, row in sim.metrics["clients"].items():
        if row["availability"] < target:
            failing.append(cid)
            notes.append(
                f"{cid}: сквозная доступность {row['availability'] * 100:.1f}% ниже цели {target * 100:.0f}%, "
                f"максимальный перерыв {row['max_outage_s'] / 60:.0f} мин."
            )
        elif row["visibility"] - row["availability"] > 0.05:
            notes.append(
                f"{cid}: спутники видны {row['visibility'] * 100:.1f}% времени, но маршрут до шлюза есть только "
                f"{row['availability'] * 100:.1f}% — узкое место в межспутниковой сети."
            )
    if stage < 3 and failing:
        notes.append(
            f"Очередь запуска {stage} из 3: нехватка аппаратов. Следующая очередь снизит перерывы на северных пунктах."
        )
    if isl <= 2000 and failing:
        notes.append(
            "Дальность ISL 2000 км рвёт межплоскостные мосты. Для северной зоны надёжнее 3000 км или более плотное фазирование."
        )
    hot = path_hotspots(sim)
    if hot:
        top = ", ".join(item["satellite_id"] for item in hot[:3])
        notes.append(f"Чаще всего в маршрутах участвуют {top}. Их отказ сильнее всего бьёт по доступности.")
    if other is not None:
        notes.extend(_compare_notes(sim, other))
    if not notes:
        notes.append(
            "Целевая доступность 90% выдержана на всех клиентских пунктах. Фиксируйте конфигурацию как опорную."
        )
    return notes


def _compare_notes(left, right) -> list[str]:
    lines = []
    for cid in left.metrics["clients"]:
        a = left.metrics["clients"][cid]["availability"]
        b = right.metrics["clients"][cid]["availability"]
        delta = (b - a) * 100
        if abs(delta) >= 1:
            winner = "второй вариант" if delta > 0 else "первый вариант"
            lines.append(f"{cid}: {winner} лучше на {abs(delta):.1f} п.п. доступности.")
    ls = left.scenario["design"]["launch_stage"]
    rs = right.scenario["design"]["launch_stage"]
    if ls != rs:
        lines.append(f"Очередь запуска: {ls} vs {rs}.")
    return lines


def compare_payload(left, right) -> dict:
    clients = {}
    for cid, row in left.metrics["clients"].items():
        other = right.metrics["clients"].get(cid, {})
        clients[cid] = {
            "left": row,
            "right": other,
            "availability_delta": other.get("availability", 0) - row["availability"],
            "max_outage_delta_s": other.get("max_outage_s", 0) - row["max_outage_s"],
        }
    return {
        "diff": design_diff(left.scenario, right.scenario),
        "clients": clients,
        "hotspots": {"left": path_hotspots(left), "right": path_hotspots(right)},
        "recommendations": recommend(left, right),
        "winner": _winner(left, right),
    }


def _winner(left, right) -> str:
    def score(sim) -> tuple:
        rows = sim.metrics["clients"].values()
        meet = sum(1 for r in rows if r["meets_target"])
        avg = sum(r["availability"] for r in rows) / max(len(rows), 1)
        outage = sum(r["max_outage_s"] for r in rows)
        return (meet, avg, -outage)

    if score(right) > score(left):
        return "right"
    if score(left) > score(right):
        return "left"
    return "tie"
