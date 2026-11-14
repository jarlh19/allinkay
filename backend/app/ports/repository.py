"""Port for storing and querying readings."""

from __future__ import annotations

from typing import Protocol

from app.domain.readings import Reading, Signal


class ReadingRepository(Protocol):
    def add(self, readings: list[Reading]) -> None: ...

    def latest(self) -> dict[Signal, Reading]: ...

    def history(self, signal: Signal, limit: int) -> list[Reading]: ...
