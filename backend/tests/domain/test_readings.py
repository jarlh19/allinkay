from datetime import UTC, datetime

import pytest

from app.domain.readings import SPECS, Frequency, InvalidReadingError, Reading, Signal, System

NOW = datetime(2026, 11, 14, 12, 0, tzinfo=UTC)


def test_every_signal_has_a_spec() -> None:
    assert set(SPECS) == set(Signal)


def test_specs_cover_the_five_panel_systems() -> None:
    assert {spec.system for spec in SPECS.values()} == set(System)


def test_white_blood_cells_come_from_an_exam() -> None:
    assert SPECS[Signal.WHITE_BLOOD_CELLS].frequency is Frequency.EXAM


def test_create_accepts_a_plausible_reading() -> None:
    reading = Reading.create("heart_rate", 72, NOW, "simulator")

    assert reading.signal is Signal.HEART_RATE
    assert reading.value == 72.0
    assert reading.spec.unit == "bpm"


@pytest.mark.parametrize(
    ("signal", "value", "taken_at", "source", "message"),
    [
        ("blood_sugar", 90, NOW, "simulator", "Unknown signal"),
        ("heart_rate", float("nan"), NOW, "simulator", "finite number"),
        ("heart_rate", float("inf"), NOW, "simulator", "finite number"),
        ("heart_rate", 400, NOW, "simulator", "outside the possible range"),
        ("spo2", 101, NOW, "simulator", "outside the possible range"),
        ("heart_rate", 72, datetime(2026, 11, 14, 12, 0), "simulator", "timezone"),
        ("heart_rate", 72, NOW, "", "source is required"),
    ],
)
def test_create_rejects_impossible_readings(
    signal: str, value: float, taken_at: datetime, source: str, message: str
) -> None:
    with pytest.raises(InvalidReadingError, match=message):
        Reading.create(signal, value, taken_at, source)
