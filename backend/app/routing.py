from __future__ import annotations

import heapq
from collections import defaultdict, deque

from .metrics import gateways_of

C_KM_S = 299792.458


def satellite_ids(scenario: dict) -> set[str]:
    return {sat["id"] for sat in scenario["design"]["satellites"]}


def build_adjacency(edges: list) -> dict[str, list[tuple[str, float]]]:
    adj: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for a, b, dist in edges:
        adj[a].append((b, float(dist)))
        adj[b].append((a, float(dist)))
    return adj


def gateway_offline_at(scenario: dict, t_s: float) -> set[str]:
    offline = set()
    for event in scenario.get("gateway_outages", []):
        if event["start_s"] <= t_s < event["end_s"]:
            offline.add(event["gateway_id"])
    return offline


def outage_reason(
    scenario: dict,
    t_s: float,
    client_id: str,
    adj: dict[str, list[tuple[str, float]]],
    sats: set[str],
) -> str:
    gw_ids = [g["id"] for g in gateways_of(scenario)]
    offline = gateway_offline_at(scenario, t_s)
    if gw_ids and all(gid in offline for gid in gw_ids):
        return "gateway_offline"
    client_links = [n for n, _ in adj.get(client_id, []) if n in sats]
    if not client_links:
        return "no_visible_satellite"
    live_gateways = [gid for gid in gw_ids if gid not in offline]
    if not any(adj.get(gid) for gid in live_gateways):
        return "no_gateway_contact"
    return "isl_disconnected"


def find_route(
    scenario: dict,
    snapshot: dict,
    client_id: str,
    mode: str = "bfs",
) -> dict:
    sats = satellite_ids(scenario)
    gw_ids = [g["id"] for g in gateways_of(scenario)]
    gw_set = set(gw_ids)
    adj = build_adjacency(snapshot["edges"])
    path: list[str] | None
    if mode == "dijkstra":
        path = _dijkstra(client_id, gw_set, adj, sats)
    else:
        path = _bfs(client_id, gw_set, adj, sats)
    if not path:
        reason = outage_reason(scenario, snapshot["t_s"], client_id, adj, sats)
        return {
            "t_s": snapshot["t_s"],
            "client_id": client_id,
            "path": [],
            "hops": None,
            "length_km": None,
            "delay_ms": None,
            "reason": reason,
        }
    length = _path_length(path, adj)
    hops = len(path) - 1
    return {
        "t_s": snapshot["t_s"],
        "client_id": client_id,
        "path": path,
        "hops": hops,
        "length_km": length,
        "delay_ms": (length / C_KM_S) * 1000.0,
        "reason": None,
    }


def _neighbors(
    node: str,
    adj: dict[str, list[tuple[str, float]]],
    sats: set[str],
    gw_set: set[str],
    start: str,
) -> list[tuple[str, float]]:
    allowed = []
    for nxt, dist in adj.get(node, []):
        if node == start:
            if nxt in sats:
                allowed.append((nxt, dist))
        elif nxt in sats or nxt in gw_set:
            allowed.append((nxt, dist))
    return allowed


def _bfs(
    start: str,
    gw_set: set[str],
    adj: dict[str, list[tuple[str, float]]],
    sats: set[str],
) -> list[str] | None:
    queue = deque([start])
    prev: dict[str, str | None] = {start: None}
    found: str | None = None
    while queue:
        node = queue.popleft()
        if node in gw_set and node != start:
            found = node
            break
        for nxt, _ in _neighbors(node, adj, sats, gw_set, start):
            if nxt in prev:
                continue
            prev[nxt] = node
            queue.append(nxt)
    if found is None:
        return None
    return _rewind(found, prev)


def _dijkstra(
    start: str,
    gw_set: set[str],
    adj: dict[str, list[tuple[str, float]]],
    sats: set[str],
) -> list[str] | None:
    dist = {start: 0.0}
    prev: dict[str, str | None] = {start: None}
    heap = [(0.0, start)]
    found: str | None = None
    found_cost = float("inf")
    while heap:
        cost, node = heapq.heappop(heap)
        if cost > dist.get(node, float("inf")):
            continue
        if node in gw_set and node != start:
            found = node
            found_cost = cost
            break
        for nxt, weight in _neighbors(node, adj, sats, gw_set, start):
            cand = cost + weight
            if cand < dist.get(nxt, float("inf")):
                dist[nxt] = cand
                prev[nxt] = node
                heapq.heappush(heap, (cand, nxt))
    if found is None or found_cost == float("inf"):
        return None
    return _rewind(found, prev)


def _rewind(end: str, prev: dict[str, str | None]) -> list[str]:
    path = [end]
    while prev[path[-1]] is not None:
        path.append(prev[path[-1]])  # type: ignore[arg-type]
    path.reverse()
    return path


def _path_length(path: list[str], adj: dict[str, list[tuple[str, float]]]) -> float:
    total = 0.0
    lookup = {node: dict(neigh) for node, neigh in adj.items()}
    for a, b in zip(path, path[1:]):
        total += float(lookup[a][b])
    return total
