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
