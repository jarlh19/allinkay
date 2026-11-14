"""Use case: compare the latest readings with the person's normal and raise explained alerts."""

from __future__ import annotations

from typing import Any

from app.application.bus import EventBus
from app.domain.baseline import Baseline, Deviation, deviation
from app.domain.modes import Mode, ModelStrategy, strategy_for
from app.domain.readings import Frequency, Reading, Signal
from app.domain.references import REFERENCES
from app.domain.rules import Alert, evaluate_rules

PERSISTENCE: dict[Frequency, int] = {
    Frequency.LIVE: 10,
    Frequency.DAILY: 2,
    Frequency.EXAM: 1,
}
"""Consecutive readings outside the normal band needed before alerting, so a single noisy
sample does not raise a false alarm: ten live readings, two days in a row, or one exam."""


class EvaluateHealth:
    def __init__(
        self,
        baselines: dict[Signal, Baseline],
        bus: EventBus,
        strategy: ModelStrategy | None = None,
        persistence: dict[Frequency, int] | None = None,
    ) -> None:
        self._baselines = dict(baselines)
        self._strategy = strategy or strategy_for(Mode.SHIP)
        self._extra: list[Alert] = []
        self._bus = bus
        self._persistence = persistence or PERSISTENCE
        self._current: dict[Signal, Deviation] = {}
        self._streak: dict[Signal, int] = {}
        self._alerts: list[Alert] = []

    def set_baseline(self, baseline: Baseline) -> None:
        self._baselines[baseline.signal] = baseline

    @property
    def alerts(self) -> list[Alert]:
        return list(self._alerts)

    @property
    def mode(self) -> Mode:
        return self._strategy.mode

    def set_mode(self, mode: Mode) -> None:
        self._strategy = strategy_for(mode)
        self._refresh()

    def on_readings(self, readings: list[Reading], extra: list[Alert] | None = None) -> list[Alert]:
        for reading in readings:
            baseline = self._baselines.get(reading.signal)
            if baseline is None:
                continue
            dev = deviation(reading, baseline)
            self._current[reading.signal] = dev
            self._streak[reading.signal] = (
                self._streak.get(reading.signal, 0) + 1 if dev.outside_normal else 0
            )
        self._extra = list(extra or [])
        return self._refresh()

    def _refresh(self) -> list[Alert]:
        confirmed = [
            d
            for d in self._current.values()
            if self._strategy.watches(d.reading.signal) and self._is_confirmed(d)
        ]
        self._alerts = [*self._extra, *evaluate_rules(self._strategy.rules, confirmed)]
        self._bus.publish(self.view())
        return self._alerts

    def _is_confirmed(self, dev: Deviation) -> bool:
        if not dev.outside_normal:
            return False
        needed = self._persistence[dev.reading.spec.frequency]
        return self._streak.get(dev.reading.signal, 0) >= needed

    def view(self) -> dict[str, Any]:
        return {
            "type": "evaluation",
            "mode": self._strategy.mode.value,
            "mitigation": self._strategy.mitigation,
            "deviations": [
                {**_deviation_to_dict(d), "confirmed": self._is_confirmed(d)}
                for d in self._current.values()
            ],
            "alerts": [_alert_to_dict(a) for a in self._alerts],
        }


def _deviation_to_dict(dev: Deviation) -> dict[str, Any]:
    return {
        "signal": dev.reading.signal.value,
        "system": dev.reading.spec.system.value,
        "value": dev.reading.value,
        "unit": dev.reading.spec.unit,
        "baseline_mean": round(dev.baseline.mean, 2),
        "normal_low": round(dev.baseline.low, 2),
        "normal_high": round(dev.baseline.high, 2),
        "baseline_source": dev.baseline.source,
        "z_score": round(dev.z_score, 2),
        "outside_normal": dev.outside_normal,
    }


def _alert_to_dict(alert: Alert) -> dict[str, Any]:
    reference = REFERENCES[alert.reference]
    return {
        "kind": alert.kind.value,
        "level": alert.level.value,
        "systems": [s.value for s in alert.systems],
        "signals": [s.value for s in alert.signals],
        "action": alert.action,
        "reference": {"id": reference.ref.value, "title": reference.title, "url": reference.url},
        "evidence": [
            {
                "signal": e.signal.value,
                "value": e.value,
                "unit": e.unit,
                "normal_low": e.normal_low,
                "normal_high": e.normal_high,
                "z_score": e.z_score,
                "direction": e.direction,
            }
            for e in alert.evidence
        ],
    }
