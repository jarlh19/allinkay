"""The mission loop: each step ingests what is due and evaluates it against the person's normal."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta

from app.adapters.simulator import Simulator
from app.application.bus import EventBus
from app.application.evaluate import EvaluateHealth
from app.application.forecast import ForecastSleep
from app.application.ingest import IngestReadings
from app.application.radiation import TrackRadiation
from app.domain.baseline import Baseline, baselines_from_readings
from app.domain.readings import Reading, Signal
from app.ports.sources import ExamScheduler

PREFLIGHT_SOURCE = "pre-flight (synthetic)"
PREFLIGHT_DAYS = 60
PREFLIGHT_LAB_DRAWS = 6
"""Sixty days of daily readings before flight, and six blood draws spread over them."""
REPEAT_AFTER = timedelta(days=1)
"""An unusual exam is repeated the next day before it can raise an alert."""


class Mission:
    def __init__(
        self,
        ingest: IngestReadings,
        evaluate: EvaluateHealth,
        radiation: TrackRadiation,
        bus: EventBus,
        forecast: ForecastSleep,
        mission_day: Callable[[datetime], int] | None = None,
        exams: ExamScheduler | None = None,
        lap: Callable[[datetime], int] | None = None,
    ) -> None:
        self.forecast = forecast
        self.ingest = ingest
        self.evaluate = evaluate
        self.radiation = radiation
        self._bus = bus
        self._mission_day = mission_day
        self._exams = exams
        self._lap = lap
        self._current_lap: int | None = None
        self._last_at: datetime | None = None

    def clock_view(self) -> dict[str, object]:
        at = self._last_at
        return {
            "type": "clock",
            "at": at.isoformat() if at else None,
            "mission_day": self._mission_day(at) if at and self._mission_day else None,
        }

    def step(self, at: datetime) -> list[Reading]:
        self._last_at = at
        self._start_lap_if_new(at)
        self._bus.publish(self.clock_view())
        readings = self.ingest.tick(at)
        if readings:
            self.radiation.on_readings(readings)
            self.forecast.on_readings(readings)
            self.evaluate.on_readings(readings, extra=self.radiation.alerts())
            for signal in self.evaluate.take_repeat_requests():
                if self._exams is not None:
                    self._exams.request_exam(signal, at + REPEAT_AFTER)
        return readings

    def _start_lap_if_new(self, at: datetime) -> None:
        """A demo script that repeats replays its readings, so the dose replays too: without
        this the career dose kept growing lap after lap past the career limit."""
        if self._lap is None:
            return
        lap = self._lap(at)
        if self._current_lap is not None and lap != self._current_lap:
            self.radiation.restart()
        self._current_lap = lap


def synthetic_preflight_baselines(
    seed: int,
    end: datetime,
    days: int = PREFLIGHT_DAYS,
    step: timedelta = timedelta(hours=1),
) -> dict[Signal, Baseline]:
    """A pre-flight reference period generated with its own seed (no real person's data):
    daily and live readings every day, and a few blood draws spread over the period."""
    simulator = Simulator(seed=seed, exam_every=timedelta(days=days) / PREFLIGHT_LAB_DRAWS)
    start = end - timedelta(days=days)
    readings: list[Reading] = []
    at = start
    while at < end:
        readings.extend(simulator.read(at))
        at += step
    return baselines_from_readings(readings, PREFLIGHT_SOURCE)
