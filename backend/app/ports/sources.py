"""Ports for anything that produces readings (simulator, NASA files, real sensors)."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from app.domain.readings import Reading


class ReadingSource(Protocol):
    """Returns the readings that are due at the given moment."""

    def read(self, at: datetime) -> list[Reading]: ...
