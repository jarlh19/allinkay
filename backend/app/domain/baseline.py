"""Personal baseline ("your normal") and how far a reading is from it."""

from __future__ import annotations

import math
from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum

from app.domain.readings import Reading, Signal

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


class BaselineError(ValueError):
    """A baseline that cannot be computed from the data given."""


@dataclass(frozen=True)
class Baseline:
    signal: Signal
    mean: float
    sd: float
    samples: int
    source: str

    @classmethod
    def from_values(cls, signal: Signal, values: Iterable[float], source: str) -> Baseline:
        data = [float(v) for v in values]
        if len(data) < 2:
            raise BaselineError(f"{signal}: at least 2 values are needed, got {len(data)}")
        mean = sum(data) / len(data)
        variance = sum((v - mean) ** 2 for v in data) / (len(data) - 1)
        sd = max(math.sqrt(variance), MIN_SD[signal])
        return cls(signal=signal, mean=mean, sd=sd, samples=len(data), source=source)

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
    return {
        signal: Baseline.from_values(signal, values, source)
        for signal, values in grouped.items()
        if len(values) >= 2
    }
