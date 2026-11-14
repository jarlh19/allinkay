from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.application.bus import EventBus
from app.application.radiation import TrackRadiation
from app.config import Settings
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
