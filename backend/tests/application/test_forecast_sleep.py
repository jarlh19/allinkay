from datetime import UTC, datetime, timedelta

from app.adapters.scenario import DEMO
from app.adapters.sqlite_repo import SqliteReadingRepository
from app.application.bus import EventBus
from app.application.forecast import ForecastSleep
from app.config import Settings
from app.container import Container
from app.domain.baseline import Baseline
from app.domain.readings import Reading, Signal

START = datetime(2026, 11, 14, tzinfo=UTC)


def night(value: float, day: int) -> Reading:
    return Reading.create("sleep_hours", value, START + timedelta(days=day), "test")


def test_forecast_is_published_once_there_are_three_nights() -> None:
    repo = SqliteReadingRepository(":memory:")
    bus = EventBus()
    queue = bus.subscribe()
    baseline = Baseline.from_values(Signal.SLEEP_HOURS, [7.0, 7.5, 8.0], "t")
    forecaster = ForecastSleep(repo, baseline, bus)

    for day, value in enumerate([7.4, 7.0, 6.6]):
        repo.add([night(value, day)])
        forecaster.on_readings([night(value, day)])

    view = queue.get_nowait()
    assert view["type"] == "forecast"
    assert view["history"] == [7.4, 7.0, 6.6]
    assert len(view["points"]) == 3
    assert view["points"][0]["value"] < 6.6
    assert view["normal_low"] == 6.75


def test_readings_without_sleep_do_not_forecast() -> None:
    bus = EventBus()
    queue = bus.subscribe()
    forecaster = ForecastSleep(SqliteReadingRepository(":memory:"), None, bus)

    forecaster.on_readings([Reading.create("heart_rate", 70, START, "t")])

    assert queue.empty()
    assert forecaster.view()["points"] == []


def test_demo_forecast_points_below_the_normal_after_sleep_drops() -> None:
    now = DEMO.start
    container = Container.build(
        Settings(db_path=":memory:", run_live_loop=False), clock=lambda: now, scenario=DEMO
    )
    for hour in range(6 * 24):
        now = DEMO.start + timedelta(hours=hour)
        container.mission.step(now)

    view = container.mission.forecast.view()
    assert view["trend_per_night"] < 0
    assert view["points"][-1]["value"] < view["normal_low"]
