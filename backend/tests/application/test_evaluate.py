from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.application.bus import EventBus
from app.application.evaluate import EvaluateHealth
from app.application.mission import PREFLIGHT_SOURCE, synthetic_preflight_baselines
from app.config import Settings
from app.domain.baseline import Baseline
from app.domain.modes import Mode
from app.domain.readings import Reading, Signal
from app.main import create_app

NOW = datetime(2026, 11, 14, 12, 0, tzinfo=UTC)


def reading(signal: str, value: float) -> Reading:
    return Reading.create(signal, value, NOW, "test")


def evaluator(bus: EventBus) -> EvaluateHealth:
    baselines = {
        Signal.SLEEP_HOURS: Baseline.from_values(Signal.SLEEP_HOURS, [7.0, 7.5, 8.0], "t"),
        Signal.WHITE_BLOOD_CELLS: Baseline.from_values(
            Signal.WHITE_BLOOD_CELLS, [5.4, 5.5, 7.0], "OSD-569"
        ),
        Signal.HEART_RATE: Baseline.from_values(Signal.HEART_RATE, [66, 68, 70], "t"),
    }
    return EvaluateHealth(baselines, bus)


def test_usual_readings_raise_no_alert() -> None:
    bus = EventBus()

    alerts = evaluator(bus).on_readings([reading("sleep_hours", 7.4)])

    assert alerts == []


def test_signals_without_baseline_are_ignored() -> None:
    alerts = evaluator(EventBus()).on_readings([reading("glucose", 300)])

    assert alerts == []


def test_drifting_signals_publish_explained_alerts_and_a_pattern() -> None:
    bus = EventBus()
    queue = bus.subscribe()
    health = evaluator(bus)

    health.on_readings([reading("sleep_hours", 5.17)])
    health.on_readings([reading("sleep_hours", 5.0)])
    health.on_readings([reading("white_blood_cells", 4.4)])

    for _ in range(2):
        queue.get_nowait()
    view = queue.get_nowait()
    kinds = [a["kind"] for a in view["alerts"]]
    assert kinds.count("outside_normal") == 2
    assert "combined_pattern" in kinds
    pattern = next(a for a in view["alerts"] if a["kind"] == "combined_pattern")
    assert pattern["reference"]["url"].startswith("https://www.nasa.gov/")
    wbc = next(d for d in view["deviations"] if d["signal"] == "white_blood_cells")
    assert wbc["baseline_source"] == "OSD-569"
    assert wbc["outside_normal"] is True


def test_synthetic_preflight_covers_every_signal() -> None:
    baselines = synthetic_preflight_baselines(seed=99, end=NOW)

    assert set(baselines) == set(Signal)
    assert all(b.source == PREFLIGHT_SOURCE for b in baselines.values())


def test_evaluation_endpoint_after_a_mission_step() -> None:
    app = create_app(Settings(db_path=":memory:", run_live_loop=False), clock=lambda: NOW)
    app.state.container.mission.step(NOW)
    client = TestClient(app)

    body = client.get("/api/evaluation").json()

    assert body["type"] == "evaluation"
    assert len(body["deviations"]) == 16


def test_a_single_noisy_live_reading_does_not_alert() -> None:
    health = evaluator(EventBus())

    assert health.on_readings([reading("heart_rate", 95)]) == []
    assert health.on_readings([reading("heart_rate", 68)]) == []


def test_a_live_signal_alerts_after_staying_outside_its_normal() -> None:
    health = evaluator(EventBus())

    results = [health.on_readings([reading("heart_rate", 95)]) for _ in range(10)]

    assert all(r == [] for r in results[:9])
    assert [a.signals for a in results[9]] == [(Signal.HEART_RATE,)]


def test_field_mode_watches_only_portable_sensors_and_skips_the_pattern() -> None:
    health = evaluator(EventBus())
    health.on_readings([reading("sleep_hours", 5.17), reading("white_blood_cells", 4.4)])
    health.on_readings([reading("sleep_hours", 5.0)])

    health.set_mode(Mode.FIELD)

    assert health.mode is Mode.FIELD
    assert health.view()["alerts"] == []
    assert health.view()["mitigation"] == "mitigation.field_indicators"


def test_mode_endpoint_switches_the_model() -> None:
    app = create_app(Settings(db_path=":memory:", run_live_loop=False), clock=lambda: NOW)
    client = TestClient(app)

    assert client.get("/api/mode").json() == {"mode": "ship"}
    assert client.put("/api/mode", json={"mode": "field"}).json() == {"mode": "field"}
    assert client.put("/api/mode", json={"mode": "moon"}).status_code == 422


def test_a_single_short_night_waits_for_a_second_day() -> None:
    health = evaluator(EventBus())

    assert health.on_readings([reading("sleep_hours", 5.0)]) == []
    assert [a.signals for a in health.on_readings([reading("sleep_hours", 5.1)])] == [
        (Signal.SLEEP_HOURS,)
    ]
