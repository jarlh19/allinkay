"""In-process publish/subscribe bus that decouples ingestion from its consumers."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

Event = dict[str, Any]


class EventBus:
    """Each subscriber gets its own bounded queue; a slow subscriber drops its oldest event."""

    def __init__(self, queue_size: int = 100) -> None:
        self._queue_size = queue_size
        self._subscribers: set[asyncio.Queue[Event]] = set()

    def subscribe(self) -> asyncio.Queue[Event]:
        queue: asyncio.Queue[Event] = asyncio.Queue(maxsize=self._queue_size)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[Event]) -> None:
        self._subscribers.discard(queue)

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def publish(self, event: Event) -> None:
        for queue in list(self._subscribers):
            if queue.full():
                dropped = queue.get_nowait()
                logger.warning("Subscriber is slow; dropped event of type %s", dropped.get("type"))
            queue.put_nowait(event)
