"""Use case: forecast the next nights of sleep against the person's normal."""

from __future__ import annotations

from typing import Any

from app.application.bus import EventBus
from app.domain.baseline import Baseline
from app.domain.forecast import Forecast, ForecastError, holt_forecast
from app.domain.readings import Reading, Signal
from app.ports.repository import ReadingRepository

HISTORY_NIGHTS = 7
HORIZON_NIGHTS = 3


class ForecastSleep:
    def __init__(
        self, repository: ReadingRepository, baseline: Baseline | None, bus: EventBus
    ) -> None:
        self._repository = repository
        self._baseline = baseline
        self._bus = bus
        self._forecast: Forecast | None = None

    def on_readings(self, readings: list[Reading]) -> None:
        if not any(r.signal is Signal.SLEEP_HOURS for r in readings):
            return
        history = [r.value for r in self._repository.history(Signal.SLEEP_HOURS, HISTORY_NIGHTS)]
        try:
            self._forecast = holt_forecast(history, HORIZON_NIGHTS)
        except ForecastError:
            return
        self._bus.publish(self.view())

    def view(self) -> dict[str, Any]:
        forecast = self._forecast
        baseline = self._baseline
        return {
            "type": "forecast",
            "signal": Signal.SLEEP_HOURS.value,
            "unit": "h",
            "history": list(forecast.history) if forecast else [],
            "points": [
                {
                    "step": p.step,
                    "value": round(p.value, 2),
                    "low": round(p.low, 2),
                    "high": round(p.high, 2),
                }
                for p in (forecast.points if forecast else ())
            ],
            "trend_per_night": round(forecast.trend_per_step, 2) if forecast else None,
            "normal_low": round(baseline.low, 2) if baseline else None,
            "normal_high": round(baseline.high, 2) if baseline else None,
            "method": "holt-linear-exponential-smoothing",
        }
