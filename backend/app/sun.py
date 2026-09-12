from __future__ import annotations

import math

from .geometry import OMEGA

# Earth's axial tilt (obliquity of the ecliptic).
OBLIQUITY = math.radians(23.4393)

# Scenario calendar day: 11 September → day of year 254.
DAY_OF_YEAR = 254


def sun_declination_rad(day_of_year: float = DAY_OF_YEAR) -> float:
    """Spencer 1971 solar declination, radians.

    Puts the terminator on the correct latitudes for the calendar day
    instead of an equatorial cut (δ = 0).
    """
    gamma = 2.0 * math.pi * (day_of_year - 1.0) / 365.0
    return (
        0.006918
        - 0.399912 * math.cos(gamma)
        + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2.0 * gamma)
        + 0.000907 * math.sin(2.0 * gamma)
        - 0.002697 * math.cos(3.0 * gamma)
        + 0.00148 * math.sin(3.0 * gamma)
    )


def sun_eci(day_of_year: float = DAY_OF_YEAR) -> tuple[float, float, float]:
    """Sun in the equatorial inertial frame used by geometry.positions()."""
    dec = sun_declination_rad(day_of_year)
    return (math.cos(dec), 0.0, math.sin(dec))


# Back-compat for eclipse lighting.
SUN_ECI = sun_eci()


def sun_ecef(scenario: dict, t_s: float) -> list[float]:
    """Subsolar direction in Earth-fixed coordinates, with axial tilt.

    Same Earth rotation as geometry.positions(): θ = earth_angle0 + Ω t.
    Declination is the tilt of the terminator relative to the geographic poles.
    """
    env = scenario["environment"]
    theta = math.radians(env["earth_angle0_deg"]) + OMEGA * t_s
    c, s = math.cos(theta), math.sin(theta)
    x, y, z = sun_eci()
    return [c * x + s * y, -s * x + c * y, z]


def ground_sun_cosine(lat_deg: float, lon_deg: float, sun: list[float]) -> float:
    """n·s at a geographic point. Positive = day, negative = night."""
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    cl = math.cos(lat)
    nx, ny, nz = cl * math.cos(lon), cl * math.sin(lon), math.sin(lat)
    sx, sy, sz = sun
    return nx * sx + ny * sy + nz * sz
