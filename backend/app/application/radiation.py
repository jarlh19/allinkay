"""Use case: keep the dose ledger up to date and raise the solar storm emergency."""

from __future__ import annotations

from dataclasses import replace
from typing import Any

from app.application.bus import EventBus
from app.domain.radiation import (
    CAREER_LIMIT_MSV,
    EVENT_LIMIT_MSV,
    ORGANS_AT_RISK,
    DoseLedger,
)
from app.domain.readings import SPECS, Reading, Signal, System
from app.domain.references import Ref
from app.domain.rules import Alert, AlertKind, Evidence, Level


class TrackRadiation:
    def __init__(self, ledger: DoseLedger, bus: EventBus) -> None:
        self._start = replace(ledger)
        self._ledger = ledger
        self._bus = bus

    def restart(self) -> None:
        """Back to the dose the mission started with, for a demo script that starts again."""
        self._ledger = replace(self._start)
        self._bus.publish(self.view())

    def on_readings(self, readings: list[Reading]) -> None:
        doses = [r for r in readings if r.signal is Signal.DOSE_TODAY]
        if not doses:
            return
        for reading in doses:
            self._ledger.record(reading.value, reading.taken_at)
        self._bus.publish(self.view())

    def alerts(self) -> list[Alert]:
        alerts: list[Alert] = []
        if self._ledger.storm_active:
            alerts.append(self._storm_alert())
        if self._ledger.accumulated_msv >= CAREER_LIMIT_MSV:
            alerts.append(self._career_limit_alert())
        return alerts

    def _career_limit_alert(self) -> Alert:
        """NASA-STD-3001 [V1 4030]: a crew member's career effective dose shall be less than
        600 mSv. Reaching it is a broken requirement, so it is an emergency; what remains is to
        keep any further dose as low as reasonably achievable (ALARA, [V1 4029])."""
        return Alert(
            kind=AlertKind.CAREER_LIMIT,
            level=Level.EMERGENCY,
            systems=(System.RADIATION,),
            evidence=(
                Evidence(
                    signal=Signal.DOSE_TODAY,
                    value=round(self._ledger.accumulated_msv, 1),
                    unit=SPECS[Signal.DOSE_TODAY].unit,
                    normal_low=0.0,
                    normal_high=CAREER_LIMIT_MSV,
                    z_score=0.0,
                    direction="above",
                ),
            ),
            reference=Ref.RADIATION_STANDARD,
            action="action.career_limit",
            signals=(Signal.DOSE_TODAY,),
        )

    def _storm_alert(self) -> Alert:
        return Alert(
            kind=AlertKind.SOLAR_STORM,
            level=Level.EMERGENCY,
            systems=(System.RADIATION,),
            evidence=(
                Evidence(
                    signal=Signal.DOSE_TODAY,
                    value=self._ledger.current_rate_msv,
                    unit=SPECS[Signal.DOSE_TODAY].unit,
                    normal_low=0.0,
                    normal_high=round(self._ledger.usual_rate_msv, 2),
                    z_score=0.0,
                    direction="above",
                ),
            ),
            reference=Ref.RADIATION_STANDARD,
            action="action.solar_storm_guide",
            signals=(Signal.DOSE_TODAY,),
        )

    def view(self) -> dict[str, Any]:
        ledger = self._ledger
        return {
            "type": "radiation",
            "dose_rate_msv_per_day": round(ledger.current_rate_msv, 2),
            "accumulated_msv": round(ledger.accumulated_msv, 1),
            "career_limit_msv": CAREER_LIMIT_MSV,
            "career_fraction": round(ledger.career_fraction, 3),
            "days_to_limit": ledger.days_to_limit,
            "event_limit_msv": EVENT_LIMIT_MSV,
            "storm_active": ledger.storm_active,
            "storm_dose_msv": round(ledger.storm_dose_msv, 1),
            "organs_at_risk": [
                {"organ": o.organ, "timeframe": o.timeframe.value} for o in ORGANS_AT_RISK
            ],
        }
