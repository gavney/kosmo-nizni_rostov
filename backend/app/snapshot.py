from __future__ import annotations

from .geometry import ground_position
from .geometry import snapshot as geometry_snapshot
from .sun import sun_ecef


def enrich_snapshot(scenario: dict, t_s: float) -> dict:
    """UI frame: geometry + sun direction + ground markers. No elevation maps / eclipse."""
    snap = geometry_snapshot(scenario, t_s)
    # Drop bulky per-site elevation maps — frontend does not use them.
    snap.pop("elevation_deg", None)
    snap["sun_ecef"] = sun_ecef(scenario, t_s)
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
