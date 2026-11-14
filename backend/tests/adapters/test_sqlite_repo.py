import sqlite3
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


def test_each_crew_member_only_sees_their_own_readings(tmp_path: Path) -> None:
    path = tmp_path / "crew.db"
    commander = SqliteReadingRepository(path, crew="commander")
    engineer = SqliteReadingRepository(path, crew="engineer")
    commander.add([reading("heart_rate", 70, 0)])
    engineer.add([reading("heart_rate", 95, 1)])

    assert commander.latest()[Signal.HEART_RATE].value == 70
    assert engineer.latest()[Signal.HEART_RATE].value == 95
    assert [r.value for r in engineer.history(Signal.HEART_RATE, 10)] == [95]
    commander.close()
    engineer.close()


def test_a_file_from_before_the_crew_keeps_its_readings_for_the_commander(
    tmp_path: Path,
) -> None:
    path = tmp_path / "old.db"
    old = sqlite3.connect(path)
    old.execute(
        "CREATE TABLE readings (id INTEGER PRIMARY KEY AUTOINCREMENT, signal TEXT NOT NULL, "
        "value REAL NOT NULL, taken_at TEXT NOT NULL, source TEXT NOT NULL)"
    )
    old.execute(
        "INSERT INTO readings (signal, value, taken_at, source) VALUES (?, ?, ?, ?)",
        ("spo2", 96.0, START.isoformat(), "test"),
    )
    old.commit()
    old.close()

    repo = SqliteReadingRepository(path)

    assert repo.latest()[Signal.SPO2].value == 96
    assert SqliteReadingRepository(path, crew="engineer").latest() == {}
