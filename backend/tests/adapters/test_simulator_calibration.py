"""The simulated cabin stays tied to the real ISS cabin readings summarised in data/eda."""

from __future__ import annotations

import csv
import statistics

import pytest

from app.adapters.simulator import DEFAULT_PROFILES
from app.config import DATA_DIR
from app.domain.readings import Signal

EDA_CSV = DATA_DIR / "eda" / "iss_cabin_by_mission.csv"
MMHG_PER_PPM = 760 / 1_000_000  # at the simulator's cabin pressure of 101.3 kPa


def _column(reading: str, field: str) -> list[float]:
    with EDA_CSV.open(newline="", encoding="utf-8") as f:
        return [float(row[field]) for row in csv.DictReader(f) if row["reading"] == reading]


def test_the_summary_covers_several_missions() -> None:
    assert len(_column("temperature", "median")) >= 9
    assert len(_column("co2", "median")) >= 9


def test_cabin_temperature_is_centred_on_the_median_iss_mission() -> None:
    profile = DEFAULT_PROFILES[Signal.CABIN_TEMPERATURE]
    centre = statistics.median(_column("temperature", "median"))
    spread = statistics.median(_column("temperature", "iqr_sd"))
    assert profile.mean == pytest.approx(centre, abs=0.05)
    assert profile.sd == pytest.approx(spread, abs=0.05)


def test_cabin_co2_is_centred_on_the_median_iss_mission_in_mmhg() -> None:
    profile = DEFAULT_PROFILES[Signal.CABIN_CO2]
    centre = statistics.median(_column("co2", "median")) * MMHG_PER_PPM
    spread = statistics.median(_column("co2", "iqr_sd")) * MMHG_PER_PPM
    assert profile.mean == pytest.approx(centre, abs=0.05)
    assert profile.sd == pytest.approx(spread, abs=0.05)
