"""Reads the NASA OSDR complete blood count (OSD-569) to build a real personal baseline."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from app.domain.baseline import Baseline
from app.domain.readings import Signal

WBC_ANALYTE = "WHITE BLOOD CELL COUNT"
PREFLIGHT_POINTS = ("L-92", "L-44", "L-3")


class OsdrDataError(ValueError):
    """The OSDR file is missing data the baseline needs."""


@dataclass(frozen=True)
class GeneralRange:
    low: float
    high: float
    unit: str


def load_wbc_baseline(
    path: Path, subject: str = "C001", points: tuple[str, ...] = PREFLIGHT_POINTS
) -> tuple[Baseline, GeneralRange]:
    """Pre-flight white blood cell baseline of one crew member, plus the lab's general range."""
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = [
            row
            for row in csv.DictReader(handle)
            if row["ANALYTE"] == WBC_ANALYTE and row["SUBJECT_ID"] == subject
        ]
    by_point = {row["TEST_DATE"]: row for row in rows}
    missing = [p for p in points if p not in by_point]
    if missing:
        raise OsdrDataError(f"{subject}: no white blood cell count for {', '.join(missing)}")
    values = [float(by_point[p]["VALUE"]) for p in points]
    first = by_point[points[0]]
    general = GeneralRange(
        low=float(first["RANGE_MIN"]), high=float(first["RANGE_MAX"]), unit=first["UNITS"]
    )
    source = f"NASA OSDR OSD-569 ({subject}, pre-flight {', '.join(points)})"
    return Baseline.from_lab_values(Signal.WHITE_BLOOD_CELLS, values, source), general
