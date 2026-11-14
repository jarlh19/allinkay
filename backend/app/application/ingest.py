"""Use case: take what a source has due, store it and announce it."""

from __future__ import annotations

from datetime import datetime

from app.application.bus import EventBus
from app.application.serializers import reading_to_dict
from app.domain.readings import Reading
from app.ports.repository import ReadingRepository
from app.ports.sources import ReadingSource


class IngestReadings:
    def __init__(self, source: ReadingSource, repository: ReadingRepository, bus: EventBus) -> None:
        self._source = source
        self._repository = repository
        self._bus = bus

    def tick(self, at: datetime) -> list[Reading]:
        readings = self._source.read(at)
        if not readings:
            return []
        self._repository.add(readings)
        self._bus.publish(
            {
                "type": "readings",
                "at": at.isoformat(),
                "readings": [reading_to_dict(r) for r in readings],
            }
        )
        return readings
