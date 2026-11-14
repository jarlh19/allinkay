"""Scripted demo mission: synthetic drifts and a solar storm on an accelerated clock.

Nothing here is a real person's data. The script shows how the app reacts: first an early
warning, then a combined pattern across systems, then a solar storm emergency.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.domain.readings import Signal


@dataclass(frozen=True)
class Drift:
    """A steady change per mission day, starting on a given day, capped at a total."""

    signal: Signal
    start_day: float
    per_day: float
    cap: float

    def offset(self, day: float) -> float:
        if day < self.start_day:
            return 0.0
        change = (day - self.start_day) * self.per_day
        return max(change, self.cap) if self.per_day < 0 else min(change, self.cap)


@dataclass(frozen=True)
class Spike:
    """A temporary jump, such as the dose rate during a solar particle event."""

    signal: Signal
    start_day: float
    hours: float
    offset: float

    def active(self, day: float) -> bool:
        return self.start_day <= day < self.start_day + self.hours / 24


@dataclass(frozen=True)
class Scenario:
    name: str
    start: datetime
    first_mission_day: int
    drifts: tuple[Drift, ...]
    spikes: tuple[Spike, ...]
    exam_every: timedelta
    cycle_days: float | None = None

    def elapsed_days(self, at: datetime) -> float:
        return (at - self.start) / timedelta(days=1)

    def day(self, at: datetime) -> float:
        """Day within the script; with a cycle, the script repeats so the demo never ends."""
        elapsed = self.elapsed_days(at)
        return elapsed % self.cycle_days if self.cycle_days else elapsed

    def mission_day(self, at: datetime) -> int:
        return self.first_mission_day + int(self.elapsed_days(at))

    def offset(self, signal: Signal, at: datetime) -> float:
        day = self.day(at)
        total = sum(d.offset(day) for d in self.drifts if d.signal is signal)
        total += sum(s.offset for s in self.spikes if s.signal is signal and s.active(day))
        return total


DEMO = Scenario(
    name="demo",
    start=datetime(2026, 11, 14, 0, 0, tzinfo=UTC),
    first_mission_day=90,
    drifts=(
        Drift(Signal.SLEEP_HOURS, start_day=2, per_day=-0.6, cap=-2.6),
        Drift(Signal.REACTION_TIME, start_day=2, per_day=18, cap=80),
        Drift(Signal.WHITE_BLOOD_CELLS, start_day=4, per_day=-0.9, cap=-2.0),
        Drift(Signal.MOOD, start_day=4, per_day=-0.3, cap=-1.2),
    ),
    spikes=(Spike(Signal.DOSE_TODAY, start_day=8, hours=6, offset=118),),
    exam_every=timedelta(days=3),
    cycle_days=10,
)


class AcceleratedClock:
    """Mission time that runs `speed` times faster than real time, from the scenario start."""

    def __init__(self, start: datetime, speed: float) -> None:
        self._start = start
        self._speed = speed
        self._real_start = time.monotonic()

    def __call__(self) -> datetime:
        elapsed = time.monotonic() - self._real_start
        return self._start + timedelta(seconds=elapsed * self._speed)
