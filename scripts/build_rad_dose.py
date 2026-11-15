"""Rebuild data/rad from NASA's Planetary Data System: the dose that Curiosity's RAD measured
on its way to Mars, from 28 February to 15 March 2012 (before and during the solar storm of
7 March 2012).

Each RAD RDR file holds one day of observations (20 to 55 MB, mostly particle events). This
script streams each file and keeps only, per observation, its start time (UTC), its length and
the total dose of detectors B (silicon) and E (plastic), in microgray per hour. Nothing else
is changed or computed.

Usage: python scripts/build_rad_dose.py [--first-doy 59] [--last-doy 75]
Source: PDS PPI node, data set MSL-M-RAD-3-RDR-V1.0, directory DATA/CRUISE.
"""

from __future__ import annotations

import argparse
import csv
import re
import urllib.request
from collections.abc import Iterable, Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

BASE = "https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/DATA/CRUISE/"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "rad" / "MSL_RAD_cruise_dose_2012-02-28_2012-03-15.csv"
FIELDS = ("start_utc", "duration_s", "dose_b_ugy_h", "dose_e_ugy_h", "qc", "file")


def file_names(first_doy: int, last_doy: int) -> list[str]:
    with urllib.request.urlopen(BASE, timeout=120) as response:
        listing = response.read().decode("utf-8", "replace")
    names = set(re.findall(r"RAD_RDR_\d{4}_\d{3}_[0-9_]+_C\d+_V\d+\.TXT", listing))
    return sorted(n for n in names if first_doy <= int(n.split("_")[3]) <= last_doy)


def observations(lines: Iterable[str], file: str) -> Iterator[dict[str, str]]:
    """The dose of each [OBSERVATION] block, read from the RDR text format (RAD RDR SIS)."""
    current: dict[str, str] = {}
    section = ""
    for raw in lines:
        line = raw.strip()
        if line.startswith("["):
            name = line[1:].split(":")[0].rstrip("]")
            if name == "OBSERVATION":
                yield from _complete(current, file)
                current = {}
            section = name
            continue
        if not line:
            continue
        if section == "OBSERVATION" and line.startswith("START_OBS_UTC="):
            current["start"] = line.split("=", 1)[1].strip('"')
        elif section == "OBSERVATION" and line.startswith("QC="):
            current["qc"] = line.split("=", 1)[1]
        elif section == "COUNTER_L1" and line[0].isdigit() and '"' in line:
            numbers = line.rsplit('"', 1)[1].split()
            if len(numbers) > 2 and numbers[2].lstrip("-").isdigit():
                current["duration"] = str(max(int(current.get("duration", -1)), int(numbers[2])))
        elif section == "DOSIMETRY_TOTAL_DOSE_B" and "b" not in current:
            current["b"] = line
        elif section == "DOSIMETRY_TOTAL_DOSE_E" and "e" not in current:
            current["e"] = line
    yield from _complete(current, file)


def _complete(current: dict[str, str], file: str) -> Iterator[dict[str, str]]:
    if not {"start", "b", "e"} <= current.keys():
        return
    start = datetime.strptime(current["start"], "%Y-%j %H:%M:%S").replace(tzinfo=UTC)
    yield {
        "start_utc": start.isoformat().replace("+00:00", "Z"),
        "duration_s": current.get("duration", ""),
        "dose_b_ugy_h": current["b"],
        "dose_e_ugy_h": current["e"],
        "qc": current.get("qc", ""),
        "file": file,
    }


def read_file(name: str) -> list[dict[str, str]]:
    with urllib.request.urlopen(BASE + name, timeout=1200) as response:
        lines = (raw.decode("ascii", "replace") for raw in response)
        return list(observations(lines, name))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--first-doy", type=int, default=59)
    parser.add_argument("--last-doy", type=int, default=75)
    args = parser.parse_args()
    names = file_names(args.first_doy, args.last_doy)
    with ThreadPoolExecutor(max_workers=3) as pool:
        rows = [row for rows in pool.map(read_file, names) for row in rows]
    rows.sort(key=lambda r: r["start_utc"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"{len(rows)} observations from {len(names)} files -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
