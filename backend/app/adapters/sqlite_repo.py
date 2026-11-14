"""SQLite implementation of the reading repository, one view per crew member."""

from __future__ import annotations

import sqlite3
import threading
from datetime import datetime
from pathlib import Path

from app.domain.crew import DEFAULT_CREW_ID
from app.domain.readings import Reading, Signal

_TABLE = """
CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal TEXT NOT NULL,
    value REAL NOT NULL,
    taken_at TEXT NOT NULL,
    source TEXT NOT NULL,
    crew TEXT NOT NULL DEFAULT 'commander'
)
"""
_INDEX = "CREATE INDEX IF NOT EXISTS idx_readings_crew_signal ON readings (crew, signal)"


def _add_crew_column(conn: sqlite3.Connection) -> None:
    """Files written before there was a crew keep their rows, assigned to the commander."""
    columns = {row[1] for row in conn.execute("PRAGMA table_info(readings)")}
    if "crew" not in columns:
        conn.execute(
            f"ALTER TABLE readings ADD COLUMN crew TEXT NOT NULL DEFAULT '{DEFAULT_CREW_ID}'"
        )


class SqliteReadingRepository:
    """Stores one crew member's readings in a SQLite file (or in memory with ':memory:')."""

    def __init__(self, path: str | Path, crew: str = DEFAULT_CREW_ID) -> None:
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._crew = crew
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(path), check_same_thread=False, timeout=10)
        with self._conn:
            self._conn.execute(_TABLE)
            _add_crew_column(self._conn)
            self._conn.execute(_INDEX)

    def add(self, readings: list[Reading]) -> None:
        rows = [
            (r.signal.value, r.value, r.taken_at.isoformat(), r.source, self._crew)
            for r in readings
        ]
        with self._lock, self._conn:
            self._conn.executemany(
                "INSERT INTO readings (signal, value, taken_at, source, crew) "
                "VALUES (?, ?, ?, ?, ?)",
                rows,
            )

    def latest(self) -> dict[Signal, Reading]:
        query = """
            SELECT signal, value, taken_at, source FROM readings
            WHERE id IN (SELECT MAX(id) FROM readings WHERE crew = ? GROUP BY signal)
        """
        with self._lock:
            rows = self._conn.execute(query, (self._crew,)).fetchall()
        readings = [_to_reading(row) for row in rows]
        return {reading.signal: reading for reading in readings}

    def history(self, signal: Signal, limit: int) -> list[Reading]:
        query = """
            SELECT signal, value, taken_at, source FROM readings
            WHERE crew = ? AND signal = ? ORDER BY id DESC LIMIT ?
        """
        with self._lock:
            rows = self._conn.execute(query, (self._crew, signal.value, limit)).fetchall()
        return [_to_reading(row) for row in reversed(rows)]

    def close(self) -> None:
        with self._lock:
            self._conn.close()


def _to_reading(row: tuple[str, float, str, str]) -> Reading:
    signal, value, taken_at, source = row
    return Reading.create(signal, value, datetime.fromisoformat(taken_at), source)
