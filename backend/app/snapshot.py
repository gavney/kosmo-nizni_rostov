from __future__ import annotations

from .geometry import snapshot as geometry_snapshot
from .sun import SUN_ECI, sun_ecef
from .geometry import sunlight, ground_position


def enrich_snapshot(scenario: dict, t_s: float) -> dict:
    snap = geometry_snapshot(scenario, t_s)
    sun = sun_ecef(scenario, t_s)
    lit = sunlight(scenario, t_s, list(SUN_ECI))
    for sat in snap["satellites"]:
        sat["sunlit"] = bool(lit.get(sat["id"], False))
    snap["sun_ecef"] = sun
    snap["ground"] = []
    for site in scenario["ground_sites"]:
        xyz = ground_position(site)
        snap["ground"].append(
            {
                "id": site["id"],
                "name": site.get("name", site["id"]),
                "role": site["role"],
                "lat_deg": site["lat_deg"],
                "lon_deg": site["lon_deg"],
                "x_km": float(xyz[0]),
                "y_km": float(xyz[1]),
                "z_km": float(xyz[2]),
            }
        )
    return snap
