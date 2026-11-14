"""How much a lab result varies in the same healthy person, from published data.

A few draws before flight are not enough to estimate a person's own spread, so for lab exams
the spread comes from the EFLM Biological Variation Database: the within-subject variation
(CVI) plus the analytical imprecision of a method that meets the desirable goal of half the
CVI (Fraser, 2001). Their combination is what the reference change value is built on.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.domain.readings import Signal

EFLM_DATABASE = "https://biologicalvariation.eu/"


@dataclass(frozen=True)
class LabVariation:
    signal: Signal
    cvi: float
    source: str

    @property
    def cva(self) -> float:
        """Desirable analytical imprecision: half the within-subject variation."""
        return self.cvi / 2

    @property
    def total_cv(self) -> float:
        return math.sqrt(self.cvi**2 + self.cva**2)


LAB_VARIATION: dict[Signal, LabVariation] = {
    Signal.WHITE_BLOOD_CELLS: LabVariation(
        Signal.WHITE_BLOOD_CELLS,
        cvi=0.111,
        source="EFLM Biological Variation Database, leukocytes in whole blood, "
        "meta-analysis updated 2026-10-08 (CVI 11.1%)",
    ),
    Signal.GLUCOSE: LabVariation(
        Signal.GLUCOSE,
        cvi=0.049,
        source="EFLM Biological Variation Database, glucose in serum/plasma, "
        "meta-analysis updated 2026-10-08 (CVI 4.9%)",
    ),
}
