"""Composition root: wires adapters to ports so the rest of the code never builds them."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from app.adapters.simulator import Simulator
from app.adapters.sqlite_repo import SqliteReadingRepository
from app.application.bus import EventBus
from app.application.ingest import IngestReadings
from app.config import Settings

Clock = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass
class Container:
    settings: Settings
    repository: SqliteReadingRepository
    bus: EventBus
    ingest: IngestReadings
    clock: Clock

    @classmethod
    def build(cls, settings: Settings, clock: Clock = utc_now) -> Container:
        repository = SqliteReadingRepository(settings.db_path)
        bus = EventBus()
        ingest = IngestReadings(Simulator(seed=settings.seed), repository, bus)
        return cls(settings=settings, repository=repository, bus=bus, ingest=ingest, clock=clock)
