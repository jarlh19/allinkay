from pathlib import Path

import pytest

from app.adapters.osdr_csv import OsdrDataError, load_glucose_baseline, load_wbc_baseline
from app.config import OSDR_CBC_CSV, OSDR_CMP_CSV
from app.domain.readings import Signal


def test_c001_preflight_white_blood_cells_from_the_nasa_file() -> None:
    baseline, general = load_wbc_baseline(OSDR_CBC_CSV)

    assert baseline.signal is Signal.WHITE_BLOOD_CELLS
    assert baseline.samples == 3
    assert baseline.mean == pytest.approx(5.967, abs=0.001)
    assert "OSD-569" in baseline.source
    assert (general.low, general.high) == (3.8, 10.8)


def test_c001_preflight_glucose_from_the_nasa_file() -> None:
    baseline, general = load_glucose_baseline(OSDR_CMP_CSV)

    # Draws L-92, L-44 and L-3 of crew member C001 in OSD-575: 83, 80 and 69 mg/dL.
    assert baseline.signal is Signal.GLUCOSE
    assert baseline.samples == 3
    assert baseline.mean == pytest.approx(77.33, abs=0.01)
    assert baseline.source.startswith("NASA OSDR OSD-575 (C001, pre-flight L-92, L-44, L-3)")
    assert (general.low, general.high, general.unit) == (65, 99, "mg/dL")


def test_missing_time_point_is_reported(tmp_path: Path) -> None:
    path = tmp_path / "cbc.csv"
    path.write_text(
        "ANALYTE,VALUE,RANGE_MIN,RANGE_MAX,UNITS,TEST_TYPE,SUBJECT_ID,SEX,TEST_DATE\n"
        "WHITE BLOOD CELL COUNT,5.4,3.8,10.8,Thousand/uL,CBC,C001,M,L-92\n",
        encoding="utf-8",
    )

    with pytest.raises(OsdrDataError, match="L-44"):
        load_wbc_baseline(path)


def test_metabolic_panel_uses_its_own_time_point_column(tmp_path: Path) -> None:
    # OSD-575 names the time point column "timepoint"; OSD-569 calls it "TEST_DATE".
    path = tmp_path / "cmp.csv"
    path.write_text(
        "ANALYTE,VALUE,RANGE_MIN,RANGE_MAX,UNITS,TEST_TYPE,SUBJECT_ID,SEX,timepoint\n"
        "GLUCOSE,83,65,99,mg/dL,CMP,C001,M,L-92\n"
        "GLUCOSE,80,65,99,mg/dL,CMP,C001,M,L-44\n",
        encoding="utf-8",
    )

    with pytest.raises(OsdrDataError, match="glucose for L-3"):
        load_glucose_baseline(path)
