import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.adapters.donki_json import REFERENCE_SEP, DonkiDataError, load_storm_reference
from app.config import DONKI_FLR_JSON, DONKI_SEP_JSON


def test_the_reference_storm_is_the_real_march_2012_event_from_the_nasa_files() -> None:
    reference = load_storm_reference(DONKI_SEP_JSON, DONKI_FLR_JSON)

    assert reference.sep_id == REFERENCE_SEP == "2012-03-07T04:05:00-SEP-001"
    assert reference.particles_at == datetime(2012, 3, 7, 4, 5, tzinfo=UTC)
    assert reference.instrument == "GOES13: SEM/EPS >100 MeV"
    # Two flares are linked to the event (X5.4 and X1.3); the stronger one is named.
    assert reference.flare_class == "X5.4"
    assert reference.flare_peak_at == datetime(2012, 3, 7, 0, 24, tzinfo=UTC)
    assert reference.alert_at == datetime(2012, 3, 7, 4, 42, tzinfo=UTC)
    assert reference.source == "NASA DONKI"


def write(path: Path, data: object) -> Path:
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def sep(linked: list[str], notifications: list[str]) -> dict[str, object]:
    return {
        "sepID": REFERENCE_SEP,
        "eventTime": "2012-03-07T04:05Z",
        "instruments": [{"displayName": "GOES13: SEM/EPS >100 MeV"}],
        "linkedEvents": [{"activityID": a} for a in linked],
        "sentNotifications": [{"messageIssueTime": t} for t in notifications],
    }


def flare(flr_id: str, class_type: str, peak: str) -> dict[str, str]:
    return {"flrID": flr_id, "classType": class_type, "peakTime": peak}


def test_an_event_missing_from_the_file_is_reported(tmp_path: Path) -> None:
    seps = write(tmp_path / "sep.json", [])
    flares = write(tmp_path / "flr.json", [])

    with pytest.raises(DonkiDataError, match=REFERENCE_SEP):
        load_storm_reference(seps, flares)


def test_an_event_without_a_linked_flare_in_the_file_is_reported(tmp_path: Path) -> None:
    seps = write(tmp_path / "sep.json", [sep(["F-1"], [])])
    flares = write(tmp_path / "flr.json", [flare("OTHER", "X1.0", "2012-03-07T00:10Z")])

    with pytest.raises(DonkiDataError, match="linked flare"):
        load_storm_reference(seps, flares)


def test_flare_classes_compare_by_their_letter_first(tmp_path: Path) -> None:
    # An M9.9 flare is weaker than an X1.0 one: each letter is ten times the previous one.
    seps = write(tmp_path / "sep.json", [sep(["F-1", "F-2"], [])])
    flares = write(
        tmp_path / "flr.json",
        [flare("F-1", "M9.9", "2012-03-07T00:10Z"), flare("F-2", "X1.0", "2012-03-07T01:00Z")],
    )

    reference = load_storm_reference(seps, flares)

    assert reference.flare_class == "X1.0"
    assert reference.alert_at is None
