from __future__ import annotations


def export_result(scenario: dict, routes: list[dict]) -> dict:
    compact = []
    for item in routes:
        compact.append(
            {
                "t_s": item["t_s"],
                "client_id": item["client_id"],
                "path": item.get("path") or [],
            }
        )
    return {
        "schema_version": "cosmo-A-result-1.0",
        "effective_scenario": scenario,
        "routes": compact,
    }
