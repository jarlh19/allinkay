"""Health and environment readings: the vocabulary every other module speaks."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class System(StrEnum):
    CARDIOVASCULAR = "cardiovascular"
    NEUROLOGICAL = "neurological"
    IMMUNE = "immune"
    ENVIRONMENT = "environment"
    RADIATION = "radiation"


class Frequency(StrEnum):
    LIVE = "live"
    DAILY = "daily"
    EXAM = "exam"


class Signal(StrEnum):
    HEART_RATE = "heart_rate"
    SYSTOLIC_BP = "systolic_bp"
    DIASTOLIC_BP = "diastolic_bp"
    SPO2 = "spo2"
    SLEEP_HOURS = "sleep_hours"
    MOOD = "mood"
    REACTION_TIME = "reaction_time"
    BODY_TEMPERATURE = "body_temperature"
    WHITE_BLOOD_CELLS = "white_blood_cells"
    GLUCOSE = "glucose"
    SYMPTOMS = "symptoms"
    CABIN_TEMPERATURE = "cabin_temperature"
    CABIN_CO2 = "cabin_co2"
    CABIN_PRESSURE = "cabin_pressure"
    CABIN_PPO2 = "cabin_ppo2"
    DOSE_TODAY = "dose_today"


@dataclass(frozen=True)
class SignalSpec:
    """What a signal measures and which values are physically possible."""

    signal: Signal
    system: System
    unit: str
    frequency: Frequency
    min_possible: float
    max_possible: float


_SPECS: tuple[SignalSpec, ...] = (
    SignalSpec(Signal.HEART_RATE, System.CARDIOVASCULAR, "bpm", Frequency.LIVE, 20, 250),
    SignalSpec(Signal.SYSTOLIC_BP, System.CARDIOVASCULAR, "mmHg", Frequency.LIVE, 50, 260),
    SignalSpec(Signal.DIASTOLIC_BP, System.CARDIOVASCULAR, "mmHg", Frequency.LIVE, 20, 160),
    SignalSpec(Signal.SPO2, System.CARDIOVASCULAR, "%", Frequency.LIVE, 50, 100),
    SignalSpec(Signal.SLEEP_HOURS, System.NEUROLOGICAL, "h", Frequency.DAILY, 0, 24),
    SignalSpec(Signal.MOOD, System.NEUROLOGICAL, "1-5", Frequency.DAILY, 1, 5),
    SignalSpec(Signal.REACTION_TIME, System.NEUROLOGICAL, "ms", Frequency.DAILY, 100, 3000),
    SignalSpec(Signal.BODY_TEMPERATURE, System.IMMUNE, "°C", Frequency.LIVE, 30, 43),
    SignalSpec(Signal.WHITE_BLOOD_CELLS, System.IMMUNE, "10^3/µL", Frequency.EXAM, 0.1, 60),
    SignalSpec(Signal.GLUCOSE, System.IMMUNE, "mg/dL", Frequency.EXAM, 20, 600),
    SignalSpec(Signal.SYMPTOMS, System.IMMUNE, "count", Frequency.DAILY, 0, 30),
    SignalSpec(Signal.CABIN_TEMPERATURE, System.ENVIRONMENT, "°C", Frequency.LIVE, 5, 40),
    SignalSpec(Signal.CABIN_CO2, System.ENVIRONMENT, "mmHg", Frequency.LIVE, 0, 30),
    SignalSpec(Signal.CABIN_PRESSURE, System.ENVIRONMENT, "kPa", Frequency.LIVE, 20, 120),
    SignalSpec(Signal.CABIN_PPO2, System.ENVIRONMENT, "kPa", Frequency.LIVE, 5, 50),
    SignalSpec(Signal.DOSE_TODAY, System.RADIATION, "mSv", Frequency.LIVE, 0, 10_000),
)

SPECS: dict[Signal, SignalSpec] = {spec.signal: spec for spec in _SPECS}


class InvalidReadingError(ValueError):
    """A reading that cannot be real: unknown signal, not a number or physically impossible."""


@dataclass(frozen=True)
class Reading:
    signal: Signal
    value: float
    taken_at: datetime
    source: str

    @property
    def spec(self) -> SignalSpec:
        return SPECS[self.signal]

    @classmethod
    def create(cls, signal: str, value: float, taken_at: datetime, source: str) -> Reading:
        try:
            known = Signal(signal)
        except ValueError as error:
            raise InvalidReadingError(f"Unknown signal: {signal!r}") from error
        if taken_at.tzinfo is None:
            raise InvalidReadingError(f"{known}: timestamp must include a timezone")
        if not math.isfinite(value):
            raise InvalidReadingError(f"{known}: value must be a finite number, got {value!r}")
        spec = SPECS[known]
        if not spec.min_possible <= value <= spec.max_possible:
            raise InvalidReadingError(
                f"{known}: {value} {spec.unit} is outside the possible range "
                f"{spec.min_possible}-{spec.max_possible} {spec.unit}"
            )
        if not source:
            raise InvalidReadingError(f"{known}: source is required")
        return cls(signal=known, value=float(value), taken_at=taken_at, source=source)
