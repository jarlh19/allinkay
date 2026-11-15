"""Radiation dose against NASA limits, and which organs are at risk and when.

Limits from NASA-STD-3001 (Technical Brief OCHMO-TB-020): career effective dose below
600 mSv for every astronaut, and 250 mSv per solar particle event. This is an estimated
risk from the dose, not a diagnosis.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum

CAREER_LIMIT_MSV = 600.0
EVENT_LIMIT_MSV = 250.0
STORM_RATE_MULTIPLIER = 10.0
"""A dose rate this many times above the usual cruise rate is treated as a solar storm."""


class Timeframe(StrEnum):
    DURING_MISSION = "during_mission"
    SOLAR_STORM = "solar_storm"
    LONG_TERM = "long_term"
    GROWS_WITH_DOSE = "grows_with_dose"


@dataclass(frozen=True)
class OrganRisk:
    organ: str
    timeframe: Timeframe


# NASA: Risk of Radiation-Induced Cancers; NASA-STD-3001 brief (acute effects).
ORGANS_AT_RISK: tuple[OrganRisk, ...] = (
    OrganRisk("central_nervous_system", Timeframe.DURING_MISSION),
    OrganRisk("skin_and_bone_marrow", Timeframe.SOLAR_STORM),
    OrganRisk("heart_vessels_and_eyes", Timeframe.LONG_TERM),
    OrganRisk("cancer_risk", Timeframe.GROWS_WITH_DOSE),
)


GCR_QUALITY_FACTOR = 3.82
"""Mean quality factor of the galactic cosmic rays that Curiosity's RAD measured in transit to
Mars (Zeitlin et al., 2013): 0.481 mGy per day in tissue gave 1.84 mSv per day."""


@dataclass(frozen=True)
class DoseEquivalent:
    """Turns an absorbed dose rate in tissue (microgray per hour) into dose equivalent
    (millisievert per day).

    The cosmic-ray background and a solar storm's excess above it have different quality
    factors: cosmic rays include heavy ions, while a storm is mostly protons."""

    background_ugy_h: float
    q_excess: float
    q_background: float = GCR_QUALITY_FACTOR

    def msv_per_day(self, absorbed_ugy_h: float) -> float:
        background = min(absorbed_ugy_h, self.background_ugy_h)
        excess = max(absorbed_ugy_h - self.background_ugy_h, 0.0)
        return (background * self.q_background + excess * self.q_excess) * 24 / 1000

    @property
    def background_msv_per_day(self) -> float:
        return self.msv_per_day(self.background_ugy_h)


@dataclass(frozen=True)
class StormReference:
    """A real solar particle event that the demo storm refers to, as NASA recorded it.

    Only the event's facts are real: the size and timing of the demo storm are synthetic."""

    sep_id: str
    particles_at: datetime
    instrument: str
    flare_class: str
    flare_peak_at: datetime
    alert_at: datetime | None
    source: str = "NASA DONKI"


def days_to_limit(accumulated_msv: float, daily_rate_msv: float) -> int | None:
    """Whole days left before reaching the career limit at the current rate."""
    if daily_rate_msv <= 0:
        return None
    remaining = CAREER_LIMIT_MSV - accumulated_msv
    if remaining <= 0:
        return 0
    return math.floor(remaining / daily_rate_msv)


@dataclass
class DoseLedger:
    """Integrates the daily dose rate over time into an accumulated career dose."""

    accumulated_msv: float
    usual_rate_msv: float
    current_rate_msv: float = 0.0
    storm_dose_msv: float = 0.0
    _last_at: datetime | None = None

    def record(self, daily_rate_msv: float, at: datetime) -> None:
        if self._last_at is not None and at > self._last_at:
            elapsed_days = (at - self._last_at) / timedelta(days=1)
            dose = self.current_rate_msv * elapsed_days
            self.accumulated_msv += dose
            if self.storm_active:
                self.storm_dose_msv += dose
        self.current_rate_msv = daily_rate_msv
        if not self.storm_active:
            self.storm_dose_msv = 0.0
        self._last_at = at

    @property
    def storm_active(self) -> bool:
        return self.current_rate_msv >= self.usual_rate_msv * STORM_RATE_MULTIPLIER

    @property
    def career_fraction(self) -> float:
        return self.accumulated_msv / CAREER_LIMIT_MSV

    @property
    def days_to_limit(self) -> int | None:
        return days_to_limit(self.accumulated_msv, self.current_rate_msv)
