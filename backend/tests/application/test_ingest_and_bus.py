import asyncio
from datetime import UTC, datetime

from app.adapters.sqlite_repo import SqliteReadingRepository
from app.application.bus import EventBus
from app.application.ingest import IngestReadings
from app.domain.readings import Reading, Signal

NOW = datetime(2026, 11, 14, 12, 0, tzinfo=UTC)


class FakeSource:
    def __init__(self, readings: list[Reading]) -> None:
        self._readings = readings

    def read(self, at: datetime) -> list[Reading]:
        return self._readings


def test_tick_stores_and_publishes_due_readings() -> None:
    reading = Reading.create("heart_rate", 70, NOW, "test")
    repository = SqliteReadingRepository(":memory:")
    bus = EventBus()
    queue = bus.subscribe()

    stored = IngestReadings(FakeSource([reading]), repository, bus).tick(NOW)

    assert stored == [reading]
    assert repository.latest()[Signal.HEART_RATE].value == 70
    event = queue.get_nowait()
    assert event["type"] == "readings"
    assert event["readings"][0]["signal"] == "heart_rate"
    assert event["readings"][0]["unit"] == "bpm"


def test_tick_with_nothing_due_publishes_nothing() -> None:
    bus = EventBus()
    queue = bus.subscribe()

    IngestReadings(FakeSource([]), SqliteReadingRepository(":memory:"), bus).tick(NOW)

    assert queue.empty()


def test_slow_subscriber_drops_its_oldest_event() -> None:
    async def scenario() -> list[int]:
        bus = EventBus(queue_size=2)
        queue = bus.subscribe()
        for n in range(3):
            bus.publish({"type": "n", "n": n})
        return [queue.get_nowait()["n"] for _ in range(queue.qsize())]

    assert asyncio.run(scenario()) == [1, 2]


def test_unsubscribed_queue_stops_receiving() -> None:
    bus = EventBus()
    queue = bus.subscribe()
    bus.unsubscribe(queue)

    bus.publish({"type": "x"})

    assert queue.empty()
    assert bus.subscriber_count == 0
