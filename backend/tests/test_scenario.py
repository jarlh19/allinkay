from datetime import timedelta

import pytest

from app.adapters.scenario import DEMO, SteppingClock
from app.config import Settings
from app.container import Container
from app.domain.readings import Reading, Signal


def first_hour_of_each_alert(days: int = 9) -> dict[str, float]:
    now = DEMO.start
    container = Container.build(
        Settings(db_path=":memory:", run_live_loop=False), clock=lambda: now, scenario=DEMO
    )
    seen: dict[str, float] = {}
    for hour in range(days * 24):
        now = DEMO.start + timedelta(hours=hour)
        container.crew.default.mission.step(now)
        for alert in container.crew.default.mission.evaluate.view()["alerts"]:
            seen.setdefault(alert["kind"], hour / 24)
    return seen


def test_demo_mission_goes_from_early_warning_to_pattern_to_storm() -> None:
    seen = first_hour_of_each_alert()

    assert {"outside_normal", "combined_pattern", "solar_storm"} <= set(seen)
    assert 2 <= seen["outside_normal"] < seen["combined_pattern"] < seen["solar_storm"]
    assert 8 <= seen["solar_storm"] < 8.3


def test_demo_mission_is_repeatable() -> None:
    assert first_hour_of_each_alert() == first_hour_of_each_alert()


def test_scenario_offsets_and_mission_day() -> None:
    at_day_5 = DEMO.start + timedelta(days=5)

    assert DEMO.offset(Signal.SLEEP_HOURS, DEMO.start) == 0
    assert DEMO.offset(Signal.SLEEP_HOURS, at_day_5) == pytest.approx(-1.8)
    # The dose is not scripted: it replays RAD's measurements.
    assert DEMO.offset(Signal.DOSE_TODAY, DEMO.start + timedelta(days=8, hours=2)) == 0
    assert DEMO.mission_day(at_day_5) == 95


def test_stepping_clock_starts_at_the_scenario_start_and_needs_a_positive_step() -> None:
    clock = SteppingClock(DEMO.start, timedelta(hours=4))

    assert [clock(), clock()] == [DEMO.start, DEMO.start + timedelta(hours=4)]
    with pytest.raises(ValueError):
        SteppingClock(DEMO.start, timedelta(0))


def test_demo_script_repeats_every_ten_days() -> None:
    day_5 = DEMO.start + timedelta(days=5)
    day_15 = DEMO.start + timedelta(days=15)

    assert DEMO.offset(Signal.SLEEP_HOURS, day_15) == DEMO.offset(Signal.SLEEP_HOURS, day_5)
    assert DEMO.mission_day(day_15) == 105


def test_mission_publishes_the_mission_day() -> None:
    now = DEMO.start + timedelta(days=3, hours=2)
    container = Container.build(
        Settings(db_path=":memory:", run_live_loop=False), clock=lambda: now, scenario=DEMO
    )
    queue = container.crew.default.bus.subscribe()

    container.crew.default.mission.step(now)

    clock = queue.get_nowait()
    assert clock == {"type": "clock", "at": now.isoformat(), "mission_day": 93}


def dose_readings(days: float) -> list[Reading]:
    now = DEMO.start
    container = Container.build(
        Settings(db_path=":memory:", run_live_loop=False), clock=lambda: now, scenario=DEMO
    )
    doses: list[Reading] = []
    for hour in range(int(days * 24)):
        now = DEMO.start + timedelta(hours=hour)
        readings = container.crew.default.mission.step(now)
        doses.extend(r for r in readings if r.signal is Signal.DOSE_TODAY)
    return doses


def test_the_demo_dose_is_curiositys_measured_dose_on_its_way_to_mars() -> None:
    doses = dose_readings(days=10)
    by_day = {round((d.taken_at - DEMO.start) / timedelta(days=1), 3): d.value for d in doses}

    assert {d.source for d in doses} == {"MSL RAD (NASA PDS)"}
    # Quiet cruise before the storm: RAD's cosmic-ray background, about 1.7 mSv per day.
    quiet = [v for day, v in by_day.items() if day < 6.5]
    assert min(quiet) > 1.5 and max(quiet) < 1.9
    # 8 March 2012, the storm's second wave: read once an hour, it peaks at about 17 times the
    # background, past the storm threshold of 10 times.
    assert max(by_day.values()) == pytest.approx(29.9, abs=0.5)
