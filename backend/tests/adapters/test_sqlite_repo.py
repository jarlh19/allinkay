from datetime import UTC, datetime, timedelta
from pathlib import Path

from app.adapters.sqlite_repo import SqliteReadingRepository
from app.domain.readings import Reading, Signal

START = datetime(2026, 11, 14, 12, 0, tzinfo=UTC)


def reading(signal: str, value: float, minutes: int) -> Reading:
    return Reading.create(signal, value, START + timedelta(minutes=minutes), "test")


def test_latest_returns_the_newest_reading_of_each_signal() -> None:
    repo = SqliteReadingRepository(":memory:")
    repo.add([reading("heart_rate", 70, 0), reading("spo2", 97, 0)])
    repo.add([reading("heart_rate", 75, 1)])

    latest = repo.latest()

    assert latest[Signal.HEART_RATE].value == 75
    assert latest[Signal.SPO2].value == 97
    assert latest[Signal.HEART_RATE].taken_at == START + timedelta(minutes=1)


def test_history_is_oldest_first_and_limited() -> None:
    repo = SqliteReadingRepository(":memory:")
    repo.add([reading("heart_rate", 60 + n, n) for n in range(5)])

    history = repo.history(Signal.HEART_RATE, limit=3)

    assert [r.value for r in history] == [62, 63, 64]


def test_empty_repository_has_no_latest() -> None:
    assert SqliteReadingRepository(":memory:").latest() == {}


def test_file_repository_keeps_data_between_connections(tmp_path: Path) -> None:
    path = tmp_path / "nested" / "allinkay.db"
    first = SqliteReadingRepository(path)
    first.add([reading("glucose", 94, 0)])
    first.close()

    second = SqliteReadingRepository(path)

    assert second.latest()[Signal.GLUCOSE].value == 94
