"""Scripted demo mission: synthetic drifts and a real solar storm on an accelerated clock.

Nothing here is a real person's data. The script shows how the app reacts: first an early
warning, then a combined pattern across systems, then a solar storm emergency. The dose is not
scripted: it replays what Curiosity's RAD measured on its way to Mars from 29 February to
10 March 2012, storm of 7 March 2012 included (NASA PDS; see app.adapters.rad_csv).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta

from app.adapters.simulator import Simulator
from app.domain.readings import Reading, Signal


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
    dose_replay_start: datetime | None = None
    """When set, the dose readings replay RAD's measurements from this moment (UTC) onwards."""

    def elapsed_days(self, at: datetime) -> float:
        return (at - self.start) / timedelta(days=1)

    def day(self, at: datetime) -> float:
        """Day within the script; with a cycle, the script repeats so the demo never ends."""
        elapsed = self.elapsed_days(at)
        return elapsed % self.cycle_days if self.cycle_days else elapsed

    def lap(self, at: datetime) -> int:
        """How many times the script has repeated; always 0 without a cycle."""
        return int(self.elapsed_days(at) // self.cycle_days) if self.cycle_days else 0

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
        Drift(Signal.WHITE_BLOOD_CELLS, start_day=3, per_day=-1.75, cap=-3.5),
        Drift(Signal.MOOD, start_day=2, per_day=-0.7, cap=-2.2),
    ),
    spikes=(),
    exam_every=timedelta(days=2),
    cycle_days=10,
    dose_replay_start=datetime(2012, 2, 29, 12, 0, tzinfo=UTC),
)
"""With the replay starting at noon on 29 February 2012, the dose climbs through script day 7
(7 March) and crosses the storm threshold on day 8 (8 March, 14:52 UTC), when the storm's
second and stronger wave reached the spacecraft."""


CREW_SCENARIOS: dict[str, Scenario] = {
    "commander": DEMO,
    "engineer": replace(
        DEMO,
        name="demo-engineer",
        drifts=(
            Drift(Signal.HEART_RATE, start_day=5, per_day=9, cap=26),
            Drift(Signal.BODY_TEMPERATURE, start_day=5, per_day=0.3, cap=0.9),
        ),
    ),
    "scientist": replace(DEMO, name="demo-scientist", drifts=()),
}
"""Each crew member's script on the same clock. The commander drifts slowly inside the ship;
the engineer works outside and heats up (heart rate and body temperature, read by portable
sensors); the scientist stays well, so the crew view shows the contrast. Everyone lives through
the same measured solar storm."""


class RepeatingSource:
    """Starts a fresh source on every lap of the script, so each lap of the demo shows exactly
    the readings that were checked in the first one (the noise repeats along with the drifts)."""

    def __init__(self, make: Callable[[], Simulator], scenario: Scenario) -> None:
        self._make = make
        self._scenario = scenario
        self._lap: int | None = None
        self._source: Simulator | None = None

    def read(self, at: datetime) -> list[Reading]:
        lap = self._scenario.lap(at)
        if self._source is None or lap != self._lap:
            self._source = self._make()
            self._lap = lap
        return self._source.read(at)

    def request_exam(self, signal: Signal, at: datetime) -> None:
        if self._source is not None:
            self._source.request_exam(signal, at)


class SteppingClock:
    """Mission time for the live loop: every call is one tick and moves exactly one step.

    Real time never leaks into the readings, so the deployed demo takes the same readings at
    the same moments as the tests, however busy the server is."""

    def __init__(self, start: datetime, step: timedelta) -> None:
        if step <= timedelta(0):
            raise ValueError("The clock step must be positive")
        self._start = start
        self._step = step
        self._ticks = 0

    def __call__(self) -> datetime:
        at = self._start + self._ticks * self._step
        self._ticks += 1
        return at
