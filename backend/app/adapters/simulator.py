"""Seeded simulator of an astronaut's readings during a Mars mission.

Values are synthetic and calibrated to plausible reference levels. The same seed always
produces the same sequence, so demos and tests are repeatable.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum

import numpy as np

from app.domain.readings import SPECS, Frequency, Reading, Signal
from app.domain.variation import LAB_VARIATION

SOURCE = "simulator"

_LAB_CV = {signal: v.total_cv for signal, v in LAB_VARIATION.items()}


class Distribution(StrEnum):
    NORMAL = "normal"
    POISSON = "poisson"


@dataclass(frozen=True)
class SignalProfile:
    mean: float
    sd: float
    decimals: int
    distribution: Distribution = Distribution.NORMAL


# Synthetic but plausible levels. White blood cells and glucose use the pre-flight means of
# Inspiration4 crew member C001 (NASA OSDR: OSD-569 for 5.4, 5.5 and 7.0 thousand/µL; OSD-575
# for 83, 80 and 69 mg/dL), and the radiation dose uses the cruise
# rate measured by Curiosity on its way to Mars (Zeitlin et al., 2013). Lab exams vary as
# much as published data says they do in a healthy person, analytical error included
# (EFLM Biological Variation Database; see app.domain.variation).
DEFAULT_PROFILES: dict[Signal, SignalProfile] = {
    Signal.HEART_RATE: SignalProfile(68, 4, 0),
    Signal.SYSTOLIC_BP: SignalProfile(116, 5, 0),
    Signal.DIASTOLIC_BP: SignalProfile(75, 4, 0),
    Signal.SPO2: SignalProfile(97.5, 0.7, 0),
    Signal.SLEEP_HOURS: SignalProfile(7.4, 0.4, 2),
    Signal.MOOD: SignalProfile(3.8, 0.5, 0),
    Signal.REACTION_TIME: SignalProfile(270, 18, 0),
    Signal.BODY_TEMPERATURE: SignalProfile(36.7, 0.2, 1),
    Signal.WHITE_BLOOD_CELLS: SignalProfile(
        5.97, round(5.97 * _LAB_CV[Signal.WHITE_BLOOD_CELLS], 2), 1
    ),
    Signal.GLUCOSE: SignalProfile(77.33, round(77.33 * _LAB_CV[Signal.GLUCOSE], 1), 0),
    Signal.SYMPTOMS: SignalProfile(0.1, 0, 0, Distribution.POISSON),
    Signal.CABIN_TEMPERATURE: SignalProfile(22, 0.5, 1),
    Signal.CABIN_CO2: SignalProfile(3.0, 0.3, 1),
    Signal.CABIN_PRESSURE: SignalProfile(101.3, 0.3, 1),
    Signal.CABIN_PPO2: SignalProfile(21.2, 0.3, 1),
    Signal.DOSE_TODAY: SignalProfile(1.8, 0.1, 2),
}


class Simulator:
    """A ReadingSource that emits live signals every call and the rest when they are due."""

    def __init__(
        self,
        seed: int,
        profiles: dict[Signal, SignalProfile] | None = None,
        daily_every: timedelta = timedelta(days=1),
        exam_every: timedelta = timedelta(days=7),
        adjust: Callable[[Signal, datetime], float] | None = None,
    ) -> None:
        self._adjust = adjust
        self._rng = np.random.default_rng(seed)
        self._profiles = profiles if profiles is not None else DEFAULT_PROFILES
        missing = set(SPECS) - set(self._profiles)
        if missing:
            names = ", ".join(sorted(missing))
            raise ValueError(f"Simulator profiles missing for: {names}")
        self._every = {Frequency.DAILY: daily_every, Frequency.EXAM: exam_every}
        self._last_emitted: dict[Signal, datetime] = {}
        self._requested: dict[Signal, datetime] = {}

    def request_exam(self, signal: Signal, at: datetime) -> None:
        """An extra exam at `at` (a repeat); the regular schedule is not moved."""
        if SPECS[signal].frequency is not Frequency.EXAM:
            raise ValueError(f"{signal} is not a lab exam")
        self._requested[signal] = at

    def read(self, at: datetime) -> list[Reading]:
        readings: list[Reading] = []
        for signal, spec in SPECS.items():
            scheduled = self._is_due(signal, spec.frequency, at)
            requested = signal in self._requested and self._requested[signal] <= at
            if not (scheduled or requested):
                continue
            value = self._sample(signal, at)
            readings.append(Reading.create(signal, value, at, SOURCE))
            self._requested.pop(signal, None)
            if scheduled:
                self._last_emitted[signal] = at
        return readings

    def _is_due(self, signal: Signal, frequency: Frequency, at: datetime) -> bool:
        if frequency is Frequency.LIVE:
            return True
        last = self._last_emitted.get(signal)
        return last is None or at - last >= self._every[frequency]

    def _sample(self, signal: Signal, at: datetime) -> float:
        profile = self._profiles[signal]
        spec = SPECS[signal]
        if profile.distribution is Distribution.POISSON:
            raw = float(self._rng.poisson(profile.mean))
        else:
            raw = float(self._rng.normal(profile.mean, profile.sd))
        if self._adjust is not None:
            raw += self._adjust(signal, at)
        clipped = min(max(raw, spec.min_possible), spec.max_possible)
        return round(clipped, profile.decimals)
