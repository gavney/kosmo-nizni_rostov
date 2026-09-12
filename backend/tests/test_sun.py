from __future__ import annotations

from app.sun import ground_sun_cosine, sun_declination_rad, sun_ecef, sun_eci


def test_september_sun_is_north_of_equator() -> None:
    dec = sun_declination_rad(254)
    assert 0.04 < dec < 0.12
    eci = sun_eci()
    assert eci[2] > 0


def test_june_declination_near_obliquity() -> None:
    dec = sun_declination_rad(172)
    assert 0.38 < dec < 0.42


def test_december_declination_is_south() -> None:
    dec = sun_declination_rad(355)
    assert dec < -0.38


def test_ecef_sun_tracks_earth_rotation() -> None:
    scenario = {
        "environment": {"earth_angle0_deg": 0.0},
    }
    noon = sun_ecef(scenario, 0)
    later = sun_ecef(scenario, 21600)
    assert abs(noon[2] - later[2]) < 1e-9
    assert abs(noon[0] - later[0]) > 0.2


def test_terminator_follows_tilt_not_equator() -> None:
    scenario = {"environment": {"earth_angle0_deg": 0.0}}
    sun = sun_ecef(scenario, 0)
    # t=0, angle0=0 → subsolar near Greenwich. Equator at lon 0 is day,
    # antipode is night. North pole is still polar day in early September;
    # south pole is polar night.
    assert ground_sun_cosine(0.0, 0.0, sun) > 0.5
    assert ground_sun_cosine(0.0, 180.0, sun) < -0.5
    assert ground_sun_cosine(90.0, 0.0, sun) > 0.0
    assert ground_sun_cosine(-90.0, 0.0, sun) < 0.0
    # Murmansk afternoon at this epoch is day; 180° away is night.
    assert ground_sun_cosine(68.97, 33.07, sun) > 0.0
    assert ground_sun_cosine(68.97, -147.0, sun) < 0.0
