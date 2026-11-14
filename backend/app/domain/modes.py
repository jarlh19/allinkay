"""Where the astronaut is decides which model runs: the full one in the ship, a light one in
the field (spacewalk or surface), where only portable sensors and little computing exist."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from app.domain.readings import Signal
from app.domain.rules import CombinedPatternRule, OutsideNormalRule, Rule


class Mode(StrEnum):
    SHIP = "ship"
    FIELD = "field"


PORTABLE_SIGNALS: frozenset[Signal] = frozenset(
    {Signal.HEART_RATE, Signal.SPO2, Signal.BODY_TEMPERATURE, Signal.DOSE_TODAY}
)


@dataclass(frozen=True)
class ModelStrategy:
    mode: Mode
    signals: frozenset[Signal] | None
    rules: tuple[Rule, ...]
    mitigation: str

    def watches(self, signal: Signal) -> bool:
        return self.signals is None or signal in self.signals


def strategy_for(mode: Mode) -> ModelStrategy:
    if mode is Mode.FIELD:
        return ModelStrategy(
            mode=Mode.FIELD,
            signals=PORTABLE_SIGNALS,
            rules=(OutsideNormalRule(),),
            mitigation="mitigation.field_indicators",
        )
    return ModelStrategy(
        mode=Mode.SHIP,
        signals=None,
        rules=(OutsideNormalRule(), CombinedPatternRule()),
        mitigation="mitigation.ship_routines",
    )
