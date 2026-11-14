from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

NOW = datetime(2026, 11, 14, 12, 0, tzinfo=UTC)


def quiet_app() -> FastAPI:
    return create_app(Settings(db_path=":memory:", run_live_loop=False), clock=lambda: NOW)


def test_snapshot_is_empty_before_any_tick() -> None:
    client = TestClient(quiet_app())

    assert client.get("/api/crew/commander/snapshot").json() == {"readings": []}


def test_snapshot_returns_every_signal_after_the_first_tick() -> None:
    app = quiet_app()
    app.state.container.crew.step(NOW)
    client = TestClient(app)

    readings = client.get("/api/crew/commander/snapshot").json()["readings"]

    assert len(readings) == 16
    heart = next(r for r in readings if r["signal"] == "heart_rate")
    assert heart["unit"] == "bpm"
    assert heart["frequency"] == "live"
    assert heart["system"] == "cardiovascular"


def test_history_of_an_unknown_signal_is_404() -> None:
    client = TestClient(quiet_app())

    assert client.get("/api/crew/commander/history/blood_sugar").status_code == 404


def test_history_rejects_an_out_of_range_limit() -> None:
    client = TestClient(quiet_app())

    assert client.get("/api/crew/commander/history/heart_rate?limit=0").status_code == 422


def test_websocket_sends_a_snapshot_then_live_readings() -> None:
    app = create_app(Settings(db_path=":memory:", tick_seconds=0.01, run_live_loop=True))

    with (
        TestClient(app) as client,
        client.websocket_connect("/ws/crew/commander/live") as websocket,
    ):
        first = websocket.receive_json()
        assert first["type"] == "snapshot"
        event = websocket.receive_json()
        while event["type"] != "readings":
            event = websocket.receive_json()
        signals = {r["signal"] for r in event["readings"]}
        assert "heart_rate" in signals
