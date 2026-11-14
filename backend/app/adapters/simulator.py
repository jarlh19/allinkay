"""Seeded simulator of an astronaut's readings during a Mars mission.

Values are synthetic and calibrated to plausible reference levels. The same seed always
produces the same sequence, so demos and tests are repeatable.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum

import numpy as np

from app.domain.readings import SPECS, Frequency, Reading, Signal

SOURCE = "simulator"


class Distribution(StrEnum):
    NORMAL = "normal"
    POISSON = "poisson"


@dataclass(frozen=True)
class SignalProfile:
    mean: float
    sd: float
    decimals: int
    distribution: Distribution = Distribution.NORMAL


# Synthetic but plausible levels. White blood cells use the pre-flight mean of an
# Inspiration4 crew member (NASA OSDR, OSD-569) and the radiation dose uses the cruise
# rate measured by Curiosity on its way to Mars (Zeitlin et al., 2013).
DEFAULT_PROFILES: dict[Signal, SignalProfile] = {
    Signal.HEART_RATE: SignalProfile(68, 4, 0),
    Signal.SYSTOLIC_BP: SignalProfile(116, 5, 0),
    Signal.DIASTOLIC_BP: SignalProfile(75, 4, 0),
    Signal.SPO2: SignalProfile(97.5, 0.7, 0),
    Signal.SLEEP_HOURS: SignalProfile(7.4, 0.4, 2),
    Signal.MOOD: SignalProfile(3.8, 0.5, 0),
    Signal.REACTION_TIME: SignalProfile(270, 18, 0),
    Signal.BODY_TEMPERATURE: SignalProfile(36.7, 0.2, 1),
    Signal.WHITE_BLOOD_CELLS: SignalProfile(5.97, 0.7, 1),
    Signal.GLUCOSE: SignalProfile(92, 6, 0),
    Signal.SYMPTOMS: SignalProfile(0.2, 0, 0, Distribution.POISSON),
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
    ) -> None:
        self._rng = np.random.default_rng(seed)
        self._profiles = profiles if profiles is not None else DEFAULT_PROFILES
        missing = set(SPECS) - set(self._profiles)
        if missing:
            names = ", ".join(sorted(missing))
            raise ValueError(f"Simulator profiles missing for: {names}")
        self._every = {Frequency.DAILY: daily_every, Frequency.EXAM: exam_every}
        self._last_emitted: dict[Signal, datetime] = {}

    def read(self, at: datetime) -> list[Reading]:
        readings: list[Reading] = []
        for signal, spec in SPECS.items():
            if not self._is_due(signal, spec.frequency, at):
                continue
            value = self._sample(signal)
            readings.append(Reading.create(signal, value, at, SOURCE))
            self._last_emitted[signal] = at
        return readings

    def _is_due(self, signal: Signal, frequency: Frequency, at: datetime) -> bool:
        if frequency is Frequency.LIVE:
            return True
        last = self._last_emitted.get(signal)
        return last is None or at - last >= self._every[frequency]

    def _sample(self, signal: Signal) -> float:
        profile = self._profiles[signal]
        spec = SPECS[signal]
        if profile.distribution is Distribution.POISSON:
            raw = float(self._rng.poisson(profile.mean))
        else:
            raw = float(self._rng.normal(profile.mean, profile.sd))
        clipped = min(max(raw, spec.min_possible), spec.max_possible)
        return round(clipped, profile.decimals)
