from __future__ import annotations

import math

from .geometry import OMEGA

# Fixed inertial Sun direction for the 24-hour fixtures (equatorial).
SUN_ECI = (1.0, 0.0, 0.0)


def sun_ecef(scenario: dict, t_s: float) -> list[float]:
    env = scenario["environment"]
    theta = math.radians(env["earth_angle0_deg"]) + OMEGA * t_s
    c, s = math.cos(theta), math.sin(theta)
    x, y, z = SUN_ECI
    return [c * x + s * y, -s * x + c * y, z]
