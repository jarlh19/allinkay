"""Reads NASA DONKI space weather records to name the real event behind the demo storm.

DONKI (Space Weather Database Of Notifications, Knowledge, Information) is run by NASA's
Community Coordinated Modeling Center. The files in data/donki are its answers, unchanged.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.domain.radiation import StormReference

REFERENCE_SEP = "2012-03-07T04:05:00-SEP-001"
"""Protons above 100 MeV after the X5.4 flare of 7 March 2012. Curiosity's RAD instrument
measured the same event on its way to Mars."""

FLARE_LETTERS = "ABCMX"
"""GOES X-ray classes: each letter is ten times the previous one."""


class DonkiDataError(ValueError):
    """The DONKI file is missing data the storm reference needs."""


def load_storm_reference(
    sep_path: Path, flare_path: Path, sep_id: str = REFERENCE_SEP
) -> StormReference:
    """The solar particle event `sep_id`, with the strongest flare linked to it."""
    event = next((e for e in _read(sep_path) if e.get("sepID") == sep_id), None)
    if event is None:
        raise DonkiDataError(f"{sep_id} is not in {sep_path.name}")
    linked = {e["activityID"] for e in event.get("linkedEvents") or []}
    flares = [f for f in _read(flare_path) if f.get("flrID") in linked]
    if not flares:
        raise DonkiDataError(f"{sep_id}: no linked flare in {flare_path.name}")
    strongest = max(flares, key=lambda f: _flare_strength(f["classType"]))
    alerts = sorted(_time(n["messageIssueTime"]) for n in event.get("sentNotifications") or [])
    return StormReference(
        sep_id=sep_id,
        particles_at=_time(event["eventTime"]),
        instrument=event["instruments"][0]["displayName"],
        flare_class=strongest["classType"],
        flare_peak_at=_time(strongest["peakTime"]),
        alert_at=alerts[0] if alerts else None,
    )


def _read(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise DonkiDataError(f"{path.name}: expected a list of events")
    return data


def _time(value: str) -> datetime:
    """DONKI writes times as 2012-03-07T04:05Z, always in UTC."""
    return datetime.strptime(value, "%Y-%m-%dT%H:%MZ").replace(tzinfo=UTC)


def _flare_strength(class_type: str) -> float:
    letter, number = class_type[0].upper(), class_type[1:]
    if letter not in FLARE_LETTERS:
        raise DonkiDataError(f"Unknown flare class: {class_type!r}")
    return 10 ** FLARE_LETTERS.index(letter) * float(number or 1)
