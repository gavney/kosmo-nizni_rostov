from __future__ import annotations


def time_grid(scenario: dict) -> list[int]:
    env = scenario["environment"]
    horizon = int(env["horizon_s"])
    step = int(env["step_s"])
    return list(range(0, horizon, step))
