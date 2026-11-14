"""Ports for anything that produces readings (simulator, NASA files, real sensors)."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from app.domain.readings import Reading, Signal


class ReadingSource(Protocol):
    """Returns the readings that are due at the given moment."""

    def read(self, at: datetime) -> list[Reading]: ...


class ExamScheduler(Protocol):
    """Books an extra lab exam, for example to repeat a result before trusting it."""

    def request_exam(self, signal: Signal, at: datetime) -> None: ...
