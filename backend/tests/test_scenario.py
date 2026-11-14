from datetime import timedelta

import pytest

from app.adapters.scenario import DEMO, AcceleratedClock
from app.config import Settings
from app.container import Container
from app.domain.readings import Signal


def first_hour_of_each_alert(days: int = 9) -> dict[str, float]:
    now = DEMO.start
    container = Container.build(
        Settings(db_path=":memory:", run_live_loop=False), clock=lambda: now, scenario=DEMO
    )
    seen: dict[str, float] = {}
    for hour in range(days * 24):
        now = DEMO.start + timedelta(hours=hour)
        container.mission.step(now)
        for alert in container.evaluate.view()["alerts"]:
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
    assert DEMO.offset(Signal.DOSE_TODAY, DEMO.start + timedelta(days=8, hours=2)) == 118
    assert DEMO.mission_day(at_day_5) == 95


def test_accelerated_clock_starts_at_the_scenario_start() -> None:
    clock = AcceleratedClock(DEMO.start, speed=3600)

    assert clock() - DEMO.start < timedelta(minutes=5)


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
    queue = container.bus.subscribe()

    container.mission.step(now)

    clock = queue.get_nowait()
    assert clock == {"type": "clock", "at": now.isoformat(), "mission_day": 93}
