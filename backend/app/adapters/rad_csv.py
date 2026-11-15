"""Replays the dose that Curiosity's RAD measured on its way to Mars (NASA PDS), as the demo's
dose readings.

RAD gives, per observation, the absorbed dose rate in its plastic detector E, which is close to
human tissue, in microgray per hour. The app works in dose equivalent (mSv per day), so the
replay converts it with app.domain.radiation.DoseEquivalent, calibrated on the same file.
"""

from __future__ import annotations

import bisect
import csv
import statistics
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Protocol

from app.domain.radiation import DoseEquivalent
from app.domain.readings import Reading, Signal

SOURCE = "MSL RAD (NASA PDS)"
GOOD_QC = "00000000"
MIN_DURATION_S = 300
"""RAD observed for about 15 minutes, or about 8 during the storm; shorter ones are partial."""
DIP_RATIO = 0.85
DIP_NEIGHBOURS = 3
"""An observation below 85% of the median of the 3 before and also of the 3 after is an
isolated dip and is left out. In this file that is one observation a day, always between
09:46 and 11:02 UTC, plus one on 28 February at 13:00: a pattern of the instrument's day, not
of the radiation."""

QUIET_UNTIL = datetime(2012, 3, 7, 0, 0, tzinfo=UTC)
"""Before the storm of 7 March 2012: the cosmic-ray background."""
STORM_WINDOW = (datetime(2012, 3, 7, 0, 0, tzinfo=UTC), datetime(2012, 3, 16, 0, 0, tzinfo=UTC))
STORM_DOSE_MSV = 19.5
"""Dose equivalent of the storm's protons from 7 to 15 March 2012 inside the spacecraft, as
published from the same RAD data (Guo et al., 2015)."""


class RadDataError(ValueError):
    """The RAD file has no usable observations, or not the ones a calculation needs."""


@dataclass(frozen=True)
class RadObservation:
    start: datetime
    dose_e_ugy_h: float


def load_rad_observations(path: Path) -> list[RadObservation]:
    """Full observations with a clean quality flag, in time order, without isolated dips."""
    with path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    clean = sorted(
        (
            RadObservation(
                start=datetime.fromisoformat(row["start_utc"].replace("Z", "+00:00")),
                dose_e_ugy_h=float(row["dose_e_ugy_h"]),
            )
            for row in rows
            if row["qc"] == GOOD_QC and int(row["duration_s"] or 0) >= MIN_DURATION_S
        ),
        key=lambda o: o.start,
    )
    if not clean:
        raise RadDataError(f"{path.name}: no full observations with a clean flag")
    return [o for i, o in enumerate(clean) if not _is_dip(clean, i)]


def _is_dip(observations: list[RadObservation], index: int) -> bool:
    """Below both sides, so the last quiet reading before a sudden rise is not a dip."""
    sides = (
        observations[max(0, index - DIP_NEIGHBOURS) : index],
        observations[index + 1 : index + 1 + DIP_NEIGHBOURS],
    )
    value = observations[index].dose_e_ugy_h
    levels = [statistics.median(o.dose_e_ugy_h for o in side) for side in sides if side]
    return bool(levels) and all(value < DIP_RATIO * level for level in levels)


def calibrate(observations: list[RadObservation]) -> DoseEquivalent:
    """The background is the median before the storm; the storm's quality factor is the one
    that turns its measured excess into the published 19.5 mSv."""
    quiet = [o.dose_e_ugy_h for o in observations if o.start < QUIET_UNTIL]
    if not quiet:
        raise RadDataError("No observations before the storm to set the background")
    background = statistics.median(quiet)
    excess_mgy = _integrate_excess(observations, background, *STORM_WINDOW)
    if excess_mgy <= 0:
        raise RadDataError("No storm excess in the storm window")
    return DoseEquivalent(background_ugy_h=background, q_excess=STORM_DOSE_MSV / excess_mgy)


def _integrate_excess(
    observations: list[RadObservation], background: float, start: datetime, end: datetime
) -> float:
    """Milligray above the background, holding each observation until the next one."""
    total_ugy = 0.0
    ends = [o.start for o in observations[1:]] + [end]
    for observation, until in zip(observations, ends, strict=True):
        begin, finish = max(observation.start, start), min(until, end)
        if finish > begin:
            hours = (finish - begin) / timedelta(hours=1)
            total_ugy += max(observation.dose_e_ugy_h - background, 0.0) * hours
    return total_ugy / 1000


class DoseReplay:
    """The measured dose rate at any moment: the last observation at or before it."""

    def __init__(
        self, observations: list[RadObservation], start: datetime, conversion: DoseEquivalent
    ) -> None:
        if not observations:
            raise RadDataError("No observations to replay")
        if start < observations[0].start:
            raise RadDataError(f"The replay starts at {start}, before the first observation")
        self._times = [o.start for o in observations]
        self._doses = [o.dose_e_ugy_h for o in observations]
        self._start = start
        self.conversion = conversion

    def absorbed_ugy_h(self, elapsed: timedelta) -> float:
        index = bisect.bisect_right(self._times, self._start + elapsed) - 1
        return self._doses[max(index, 0)]

    def msv_per_day(self, elapsed: timedelta) -> float:
        return self.conversion.msv_per_day(self.absorbed_ugy_h(elapsed))


class ExamSource(Protocol):
    def read(self, at: datetime) -> list[Reading]: ...

    def request_exam(self, signal: Signal, at: datetime) -> None: ...


class ReplayedDose:
    """Wraps a reading source and replaces its dose readings with RAD's measured dose.

    `elapsed` maps the mission clock to the time since the replay's start, so a repeating demo
    script replays the same stretch of measurements on every lap."""

    def __init__(
        self, source: ExamSource, replay: DoseReplay, elapsed: Callable[[datetime], timedelta]
    ) -> None:
        self._source = source
        self._replay = replay
        self._elapsed = elapsed

    def read(self, at: datetime) -> list[Reading]:
        return [
            self._replayed(r, at) if r.signal is Signal.DOSE_TODAY else r
            for r in self._source.read(at)
        ]

    def request_exam(self, signal: Signal, at: datetime) -> None:
        self._source.request_exam(signal, at)

    def _replayed(self, reading: Reading, at: datetime) -> Reading:
        value = round(self._replay.msv_per_day(self._elapsed(at)), 2)
        return Reading.create(reading.signal, value, reading.taken_at, SOURCE)
