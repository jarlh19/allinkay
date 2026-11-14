"""Explainable alert rules. Every alert says what, with which value, against which normal,
why it matters (with its source) and what to do. Alerts support decisions; they are not
a diagnosis."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Protocol

from app.domain.baseline import Deviation
from app.domain.readings import Signal, System
from app.domain.references import SIGNAL_EVIDENCE, Ref


class Level(StrEnum):
    ATTENTION = "attention"
    EMERGENCY = "emergency"


class AlertKind(StrEnum):
    OUTSIDE_NORMAL = "outside_normal"
    COMBINED_PATTERN = "combined_pattern"
    SOLAR_STORM = "solar_storm"


@dataclass(frozen=True)
class Evidence:
    """One signal's part in an alert: the measured value against the person's normal."""

    signal: Signal
    value: float
    unit: str
    normal_low: float
    normal_high: float
    z_score: float
    direction: str


@dataclass(frozen=True)
class Alert:
    kind: AlertKind
    level: Level
    systems: tuple[System, ...]
    evidence: tuple[Evidence, ...]
    reference: Ref
    action: str
    signals: tuple[Signal, ...] = field(default=())


def _evidence(dev: Deviation) -> Evidence:
    return Evidence(
        signal=dev.reading.signal,
        value=dev.reading.value,
        unit=dev.reading.spec.unit,
        normal_low=round(dev.baseline.low, 2),
        normal_high=round(dev.baseline.high, 2),
        z_score=round(dev.z_score, 2),
        direction=dev.direction,
    )


ACTIONS: dict[System, str] = {
    System.CARDIOVASCULAR: "action.cardiovascular_routine",
    System.NEUROLOGICAL: "action.sleep_and_workload",
    System.IMMUNE: "action.immune_check",
    System.ENVIRONMENT: "action.cabin_check",
    System.RADIATION: "action.reduce_exposure",
}


class Rule(Protocol):
    def evaluate(self, deviations: Iterable[Deviation]) -> list[Alert]: ...


class OutsideNormalRule:
    """One attention alert per signal that leaves the person's normal band."""

    def evaluate(self, deviations: Iterable[Deviation]) -> list[Alert]:
        alerts = []
        for dev in deviations:
            if not dev.outside_normal:
                continue
            system = dev.reading.spec.system
            alerts.append(
                Alert(
                    kind=AlertKind.OUTSIDE_NORMAL,
                    level=Level.ATTENTION,
                    systems=(system,),
                    evidence=(_evidence(dev),),
                    reference=SIGNAL_EVIDENCE[dev.reading.signal],
                    action=ACTIONS[system],
                    signals=(dev.reading.signal,),
                )
            )
        return alerts


class CombinedPatternRule:
    """Several systems drifting at once matter more than any single signal."""

    def __init__(self, min_systems: int = 2) -> None:
        self._min_systems = min_systems

    def evaluate(self, deviations: Iterable[Deviation]) -> list[Alert]:
        outside = [dev for dev in deviations if dev.outside_normal]
        systems = tuple(sorted({dev.reading.spec.system for dev in outside}))
        if len(systems) < self._min_systems:
            return []
        signals = tuple(dev.reading.signal for dev in outside)
        reference = Ref.SLEEP if Signal.SLEEP_HOURS in signals else SIGNAL_EVIDENCE[signals[0]]
        return [
            Alert(
                kind=AlertKind.COMBINED_PATTERN,
                level=Level.ATTENTION,
                systems=systems,
                evidence=tuple(_evidence(dev) for dev in outside),
                reference=reference,
                action="action.combined_review",
                signals=signals,
            )
        ]


def evaluate_rules(rules: Iterable[Rule], deviations: Iterable[Deviation]) -> list[Alert]:
    devs = list(deviations)
    return [alert for rule in rules for alert in rule.evaluate(devs)]
