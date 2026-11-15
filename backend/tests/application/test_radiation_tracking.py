from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.adapters.scenario import DEMO
from app.application.bus import EventBus
from app.application.radiation import TrackRadiation
from app.config import Settings
from app.container import Container
from app.domain.radiation import DoseLedger
from app.domain.readings import Reading
from app.domain.rules import AlertKind, Level
from app.main import create_app

START = datetime(2026, 11, 14, 0, 0, tzinfo=UTC)


def dose(value: float, hours: float) -> Reading:
    return Reading.create("dose_today", value, START + timedelta(hours=hours), "test")


def test_usual_dose_rate_raises_no_emergency_and_publishes_the_view() -> None:
    bus = EventBus()
    queue = bus.subscribe()
    tracker = TrackRadiation(DoseLedger(accumulated_msv=256, usual_rate_msv=1.8), bus)

    tracker.on_readings([dose(1.8, 0)])

    assert tracker.alerts() == []
    view = queue.get_nowait()
    assert view["type"] == "radiation"
    assert view["accumulated_msv"] == 256
    assert view["days_to_limit"] == 191
    assert view["career_limit_msv"] == 600
    assert view["event_limit_msv"] == 250
    assert len(view["organs_at_risk"]) == 4


def test_a_solar_storm_is_an_emergency_with_its_guide() -> None:
    tracker = TrackRadiation(DoseLedger(accumulated_msv=256, usual_rate_msv=1.8), EventBus())

    tracker.on_readings([dose(1.8, 0)])
    tracker.on_readings([dose(120, 1)])

    [alert] = tracker.alerts()
    assert alert.kind is AlertKind.SOLAR_STORM
    assert alert.level is Level.EMERGENCY
    assert alert.action == "action.solar_storm_guide"


def test_radiation_endpoint() -> None:
    now = START
    app = create_app(Settings(db_path=":memory:", run_live_loop=False), clock=lambda: now)
    app.state.container.crew.default.mission.step(now)

    body = TestClient(app).get("/api/crew/commander/radiation").json()

    assert body["type"] == "radiation"
    assert body["storm_active"] is False


def test_each_lap_of_the_demo_starts_again_from_the_same_career_dose() -> None:
    now = DEMO.start
    container = Container.build(
        Settings(db_path=":memory:", run_live_loop=False), clock=lambda: now, scenario=DEMO
    )
    mission = container.crew.default.mission
    dose_on_day_5: list[float] = []
    for hour in range(26 * 24):
        now = DEMO.start + timedelta(hours=hour)
        mission.step(now)
        if hour % (10 * 24) == 5 * 24:
            dose_on_day_5.append(mission.radiation.view()["accumulated_msv"])

    assert len(dose_on_day_5) == 3
    assert dose_on_day_5[0] == dose_on_day_5[1] == dose_on_day_5[2]


def test_reaching_the_career_limit_raises_an_emergency_with_the_standard() -> None:
    tracker = TrackRadiation(DoseLedger(accumulated_msv=599.9, usual_rate_msv=1.8), EventBus())

    tracker.on_readings([dose(1.8, 0)])
    assert tracker.alerts() == []
    tracker.on_readings([dose(1.8, 2)])

    alerts = tracker.alerts()
    assert [(a.kind, a.level) for a in alerts] == [(AlertKind.CAREER_LIMIT, Level.EMERGENCY)]
    assert alerts[0].evidence[0].normal_high == 600.0
    assert alerts[0].action == "action.career_limit"


def test_a_storm_after_the_career_limit_raises_both_alerts() -> None:
    tracker = TrackRadiation(DoseLedger(accumulated_msv=605, usual_rate_msv=1.8), EventBus())

    tracker.on_readings([dose(150, 0), dose(150, 1)])

    assert {a.kind for a in tracker.alerts()} == {AlertKind.SOLAR_STORM, AlertKind.CAREER_LIMIT}
