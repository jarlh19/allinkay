"""Reads NASA OSDR lab results of the Inspiration4 crew to build real personal baselines.

- OSD-569, complete blood count: white blood cells.
- OSD-575, comprehensive metabolic panel: glucose.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from app.domain.baseline import Baseline
from app.domain.readings import Signal

PREFLIGHT_POINTS = ("L-92", "L-44", "L-3")


class OsdrDataError(ValueError):
    """The OSDR file is missing data the baseline needs."""


@dataclass(frozen=True)
class GeneralRange:
    low: float
    high: float
    unit: str


@dataclass(frozen=True)
class LabFile:
    """Where one exam lives in an OSDR study file. Studies name the time point differently."""

    study: str
    analyte: str
    signal: Signal
    point_column: str
    name: str


WBC = LabFile(
    "OSD-569",
    "WHITE BLOOD CELL COUNT",
    Signal.WHITE_BLOOD_CELLS,
    "TEST_DATE",
    "white blood cell count",
)
GLUCOSE = LabFile("OSD-575", "GLUCOSE", Signal.GLUCOSE, "timepoint", "glucose")


def load_wbc_baseline(
    path: Path, subject: str = "C001", points: tuple[str, ...] = PREFLIGHT_POINTS
) -> tuple[Baseline, GeneralRange]:
    """Pre-flight white blood cell baseline of one crew member, plus the lab's general range."""
    return _load_baseline(path, WBC, subject, points)


def load_glucose_baseline(
    path: Path, subject: str = "C001", points: tuple[str, ...] = PREFLIGHT_POINTS
) -> tuple[Baseline, GeneralRange]:
    """Pre-flight glucose baseline of one crew member, plus the lab's general range."""
    return _load_baseline(path, GLUCOSE, subject, points)


def _load_baseline(
    path: Path, lab: LabFile, subject: str, points: tuple[str, ...]
) -> tuple[Baseline, GeneralRange]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = [
            row
            for row in csv.DictReader(handle)
            if row["ANALYTE"] == lab.analyte and row["SUBJECT_ID"] == subject
        ]
    by_point = {row[lab.point_column]: row for row in rows}
    missing = [p for p in points if p not in by_point]
    if missing:
        raise OsdrDataError(f"{subject}: no {lab.name} for {', '.join(missing)}")
    values = [float(by_point[p]["VALUE"]) for p in points]
    first = by_point[points[0]]
    general = GeneralRange(
        low=float(first["RANGE_MIN"]), high=float(first["RANGE_MAX"]), unit=first["UNITS"]
    )
    source = f"NASA OSDR {lab.study} ({subject}, pre-flight {', '.join(points)})"
    return Baseline.from_lab_values(lab.signal, values, source), general
