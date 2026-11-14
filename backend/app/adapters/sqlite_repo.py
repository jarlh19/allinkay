"""SQLite implementation of the reading repository."""

from __future__ import annotations

import sqlite3
import threading
from datetime import datetime
from pathlib import Path

from app.domain.readings import Reading, Signal

_SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal TEXT NOT NULL,
    value REAL NOT NULL,
    taken_at TEXT NOT NULL,
    source TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_readings_signal_time ON readings (signal, taken_at);
"""


class SqliteReadingRepository:
    """Stores readings in a local SQLite file (or in memory with ':memory:')."""

    def __init__(self, path: str | Path) -> None:
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.executescript(_SCHEMA)

    def add(self, readings: list[Reading]) -> None:
        rows = [(r.signal.value, r.value, r.taken_at.isoformat(), r.source) for r in readings]
        with self._lock, self._conn:
            self._conn.executemany(
                "INSERT INTO readings (signal, value, taken_at, source) VALUES (?, ?, ?, ?)", rows
            )

    def latest(self) -> dict[Signal, Reading]:
        query = """
            SELECT signal, value, taken_at, source FROM readings AS r
            WHERE id = (SELECT MAX(id) FROM readings WHERE signal = r.signal)
        """
        with self._lock:
            rows = self._conn.execute(query).fetchall()
        readings = [_to_reading(row) for row in rows]
        return {reading.signal: reading for reading in readings}

    def history(self, signal: Signal, limit: int) -> list[Reading]:
        query = """
            SELECT signal, value, taken_at, source FROM readings
            WHERE signal = ? ORDER BY id DESC LIMIT ?
        """
        with self._lock:
            rows = self._conn.execute(query, (signal.value, limit)).fetchall()
        return [_to_reading(row) for row in reversed(rows)]

    def close(self) -> None:
        with self._lock:
            self._conn.close()


def _to_reading(row: tuple[str, float, str, str]) -> Reading:
    signal, value, taken_at, source = row
    return Reading.create(signal, value, datetime.fromisoformat(taken_at), source)
