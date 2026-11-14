"""Personal baseline ("your normal") and how far a reading is from it."""

from __future__ import annotations

import math
import statistics
from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum

from app.domain.readings import Reading, Signal
from app.domain.stats import normal_cdf, student_t_quantile
from app.domain.variation import LAB_VARIATION

Z_THRESHOLD = 1.5

# Smallest spread accepted for each signal, so a very stable baseline does not turn
# measurement noise into an alarm.
MIN_SD: dict[Signal, float] = {
    Signal.HEART_RATE: 2.0,
    Signal.SYSTOLIC_BP: 3.0,
    Signal.DIASTOLIC_BP: 2.0,
    Signal.SPO2: 0.5,
    Signal.SLEEP_HOURS: 0.25,
    Signal.MOOD: 0.8,
    Signal.REACTION_TIME: 10.0,
    Signal.BODY_TEMPERATURE: 0.1,
    Signal.WHITE_BLOOD_CELLS: 0.3,
    Signal.GLUCOSE: 4.0,
    Signal.SYMPTOMS: 1.0,
    Signal.CABIN_TEMPERATURE: 0.3,
    Signal.CABIN_CO2: 0.2,
    Signal.CABIN_PRESSURE: 0.3,
    Signal.CABIN_PPO2: 0.3,
    Signal.DOSE_TODAY: 0.05,
}


class Concern(StrEnum):
    BELOW = "below"
    ABOVE = "above"
    BOTH = "both"


# Which side of the normal band is a health concern. Sleeping more or a better mood than
# usual is not; less oxygen or more radiation is.
CONCERN: dict[Signal, Concern] = {
    Signal.HEART_RATE: Concern.BOTH,
    Signal.SYSTOLIC_BP: Concern.BOTH,
    Signal.DIASTOLIC_BP: Concern.BOTH,
    Signal.SPO2: Concern.BELOW,
    Signal.SLEEP_HOURS: Concern.BELOW,
    Signal.MOOD: Concern.BELOW,
    Signal.REACTION_TIME: Concern.ABOVE,
    Signal.BODY_TEMPERATURE: Concern.BOTH,
    Signal.WHITE_BLOOD_CELLS: Concern.BOTH,
    Signal.GLUCOSE: Concern.BOTH,
    Signal.SYMPTOMS: Concern.ABOVE,
    Signal.CABIN_TEMPERATURE: Concern.BOTH,
    Signal.CABIN_CO2: Concern.ABOVE,
    Signal.CABIN_PRESSURE: Concern.BOTH,
    Signal.CABIN_PPO2: Concern.BELOW,
    Signal.DOSE_TODAY: Concern.ABOVE,
}


SCALE_SIGNALS: frozenset[Signal] = frozenset({Signal.MOOD})
"""Self-reported 1-5 scales: whole numbers, so the spread is one step of the scale."""

SCALE_STEP = 1.0

SCALE_ALERT_STEPS = 2.0
"""On a 1-5 scale only whole steps exist, so a change counts toward an alert when the answer
is at least two steps away from the usual one, whatever threshold continuous signals use."""

MIN_PERSONAL_SAMPLES = 5
"""Fewer reference readings than this cannot support an alert: the normal is too uncertain."""


class Spread(StrEnum):
    """Where the width of a person's normal comes from."""

    PERSONAL = "personal"
    """Estimated from the person's own reference readings."""
    PUBLISHED = "published"
    """Lab exams: within-subject and analytical variation from published data."""
    SCALE = "scale"
    """Self-reported scales: one step of the scale."""


class BaselineError(ValueError):
    """A baseline that cannot be computed from the data given."""


@dataclass(frozen=True)
class Baseline:
    signal: Signal
    mean: float
    sd: float
    samples: int
    source: str
    spread: Spread = Spread.PERSONAL

    @classmethod
    def from_values(cls, signal: Signal, values: Iterable[float], source: str) -> Baseline:
        data = [float(v) for v in values]
        if len(data) < 2:
            raise BaselineError(f"{signal}: at least 2 values are needed, got {len(data)}")
        mean = sum(data) / len(data)
        variance = sum((v - mean) ** 2 for v in data) / (len(data) - 1)
        sd = max(math.sqrt(variance), MIN_SD[signal])
        return cls(signal=signal, mean=mean, sd=sd, samples=len(data), source=source)

    @classmethod
    def from_lab_values(cls, signal: Signal, values: Iterable[float], source: str) -> Baseline:
        """The person's set point is the mean of their own draws; the spread around it is the
        published biological and analytical variation for that exam."""
        variation = LAB_VARIATION.get(signal)
        if variation is None:
            raise BaselineError(f"{signal}: no published variation for this exam")
        data = [float(v) for v in values]
        if not data:
            raise BaselineError(f"{signal}: at least 1 draw is needed")
        mean = sum(data) / len(data)
        return cls(
            signal=signal,
            mean=mean,
            sd=mean * variation.total_cv,
            samples=len(data),
            source=f"{source}; spread: {variation.source}",
            spread=Spread.PUBLISHED,
        )

    @classmethod
    def from_scale_values(cls, signal: Signal, values: Iterable[float], source: str) -> Baseline:
        """For a 1-5 scale the usual answer is the median, and one step is the spread."""
        data = [float(v) for v in values]
        if len(data) < 2:
            raise BaselineError(f"{signal}: at least 2 values are needed, got {len(data)}")
        return cls(
            signal=signal,
            mean=statistics.median(data),
            sd=SCALE_STEP,
            samples=len(data),
            source=source,
            spread=Spread.SCALE,
        )

    def alert_z(self, z: float) -> float:
        """How many sd a single new reading must be from the mean to be as unusual as `z`
        would be if the normal were known exactly.

        The normal comes from a limited reference, so a new reading is judged with a
        prediction interval: Student's t for a spread estimated from the person's own
        readings, and the set point's uncertainty (1 + 1/n). Scales count whole steps instead.
        """
        if self.spread is Spread.SCALE:
            return SCALE_ALERT_STEPS
        if self.spread is Spread.PERSONAL and self.samples < MIN_PERSONAL_SAMPLES:
            return math.inf
        inflation = math.sqrt(1 + 1 / self.samples)
        if self.spread is Spread.PUBLISHED:
            return z * inflation
        return student_t_quantile(normal_cdf(z), self.samples - 1) * inflation

    @property
    def low(self) -> float:
        return self.mean - Z_THRESHOLD * self.sd

    @property
    def high(self) -> float:
        return self.mean + Z_THRESHOLD * self.sd


@dataclass(frozen=True)
class Deviation:
    reading: Reading
    baseline: Baseline
    z_score: float

    @property
    def outside_normal(self) -> bool:
        """Outside the normal band on the side that is a health concern for this signal."""
        if abs(self.z_score) < Z_THRESHOLD:
            return False
        concern = CONCERN[self.reading.signal]
        return concern is Concern.BOTH or concern.value == self.direction

    @property
    def direction(self) -> str:
        return "above" if self.z_score > 0 else "below"

    def beyond(self, z: float) -> str | None:
        """The direction if this reading is at least as unusual as `z` (judged with the
        prediction interval of its baseline) on a side that is a health concern."""
        if abs(self.z_score) < self.baseline.alert_z(z):
            return None
        concern = CONCERN[self.reading.signal]
        if concern is Concern.BOTH or concern.value == self.direction:
            return self.direction
        return None


def deviation(reading: Reading, baseline: Baseline) -> Deviation:
    if reading.signal is not baseline.signal:
        raise BaselineError(f"Baseline for {baseline.signal} cannot evaluate {reading.signal}")
    z = (reading.value - baseline.mean) / baseline.sd
    return Deviation(reading=reading, baseline=baseline, z_score=z)


def baselines_from_readings(readings: Iterable[Reading], source: str) -> dict[Signal, Baseline]:
    """Build a baseline per signal from a reference period (pre-flight and first weeks)."""
    grouped: dict[Signal, list[float]] = {}
    for reading in readings:
        grouped.setdefault(reading.signal, []).append(reading.value)
    baselines: dict[Signal, Baseline] = {}
    for signal, values in grouped.items():
        if signal in LAB_VARIATION:
            baselines[signal] = Baseline.from_lab_values(signal, values, source)
        elif len(values) < 2:
            continue
        elif signal in SCALE_SIGNALS:
            baselines[signal] = Baseline.from_scale_values(signal, values, source)
        else:
            baselines[signal] = Baseline.from_values(signal, values, source)
    return baselines
