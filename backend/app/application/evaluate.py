"""Use case: compare the latest readings with the person's normal and raise explained alerts."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Any

from app.application.bus import EventBus
from app.domain.baseline import Baseline, Deviation, deviation
from app.domain.modes import Mode, ModelStrategy, strategy_for
from app.domain.readings import Frequency, Reading, Signal
from app.domain.references import REFERENCES
from app.domain.rules import Alert, evaluate_rules


@dataclass(frozen=True)
class Confirmation:
    z: float
    count: int
    window: int


CONFIRMATION: dict[Frequency, Confirmation] = {
    Frequency.LIVE: Confirmation(z=1.5, count=10, window=10),
    Frequency.DAILY: Confirmation(z=2.2, count=3, window=4),
    Frequency.EXAM: Confirmation(z=2.58, count=2, window=2),
}
"""A reading counts toward an alert when it is at least as unusual as `z`, judged with the
prediction interval of the person's normal, on the side that is a health concern. The alert
needs `count` of the last `window` readings to count on the same side: ten live readings in a
row, three of the last four days (one ordinary day inside a real change does not reset it), or
an exam and its repeat (2.58 is the 99% reference change value for serial lab results).
Chosen by measuring false alarms and misses on synthetic people (backend/validate_model.py)."""


class EvaluateHealth:
    def __init__(
        self,
        baselines: dict[Signal, Baseline],
        bus: EventBus,
        strategy: ModelStrategy | None = None,
        confirmation: dict[Frequency, Confirmation] | None = None,
    ) -> None:
        self._baselines = dict(baselines)
        self._strategy = strategy or strategy_for(Mode.SHIP)
        self._extra: list[Alert] = []
        self._bus = bus
        self._confirmation = confirmation or CONFIRMATION
        self._current: dict[Signal, Deviation] = {}
        self._recent: dict[Signal, deque[str | None]] = {}
        self._repeats_to_request: list[Signal] = []
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
            self._count(dev)
        self._extra = list(extra or [])
        return self._refresh()

    def _count(self, dev: Deviation) -> None:
        signal = dev.reading.signal
        rule = self._confirmation[dev.reading.spec.frequency]
        recent = self._recent.setdefault(signal, deque(maxlen=rule.window))
        side = dev.beyond(rule.z)
        recent.append(side)
        is_exam = dev.reading.spec.frequency is Frequency.EXAM
        if side is not None and is_exam and self._counted(signal) < rule.count:
            self._repeats_to_request.append(signal)

    def _counted(self, signal: Signal) -> int:
        """Readings that count toward an alert among the recent ones, on the busiest side."""
        sides = [side for side in self._recent.get(signal, ()) if side is not None]
        return max((sides.count(side) for side in set(sides)), default=0)

    def take_repeat_requests(self) -> list[Signal]:
        """Exams that came out unusual once and must be repeated before they can alert."""
        requests, self._repeats_to_request = self._repeats_to_request, []
        return requests

    def _waiting_for_repeat(self, dev: Deviation) -> bool:
        if dev.reading.spec.frequency is not Frequency.EXAM:
            return False
        recent = self._recent.get(dev.reading.signal)
        if not recent or recent[-1] is None:
            return False
        return self._counted(dev.reading.signal) < self._confirmation[Frequency.EXAM].count

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
        needed = self._confirmation[dev.reading.spec.frequency].count
        return self._counted(dev.reading.signal) >= needed

    def view(self) -> dict[str, Any]:
        return {
            "type": "evaluation",
            "mode": self._strategy.mode.value,
            "mitigation": self._strategy.mitigation,
            "deviations": [
                {
                    **_deviation_to_dict(d),
                    "confirmed": self._is_confirmed(d),
                    "repeat_requested": self._waiting_for_repeat(d),
                }
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
