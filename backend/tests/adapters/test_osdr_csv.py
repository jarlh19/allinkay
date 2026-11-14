from pathlib import Path

import pytest

from app.adapters.osdr_csv import OsdrDataError, load_wbc_baseline
from app.config import OSDR_CBC_CSV
from app.domain.readings import Signal


def test_c001_preflight_white_blood_cells_from_the_nasa_file() -> None:
    baseline, general = load_wbc_baseline(OSDR_CBC_CSV)

    assert baseline.signal is Signal.WHITE_BLOOD_CELLS
    assert baseline.samples == 3
    assert baseline.mean == pytest.approx(5.967, abs=0.001)
    assert "OSD-569" in baseline.source
    assert (general.low, general.high) == (3.8, 10.8)


def test_missing_time_point_is_reported(tmp_path: Path) -> None:
    path = tmp_path / "cbc.csv"
    path.write_text(
        "ANALYTE,VALUE,RANGE_MIN,RANGE_MAX,UNITS,TEST_TYPE,SUBJECT_ID,SEX,TEST_DATE\n"
        "WHITE BLOOD CELL COUNT,5.4,3.8,10.8,Thousand/uL,CBC,C001,M,L-92\n",
        encoding="utf-8",
    )

    with pytest.raises(OsdrDataError, match="L-44"):
        load_wbc_baseline(path)
