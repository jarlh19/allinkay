"""Summarise the real ISS cabin readings of NASA OSDR's Environmental Data App (EDA).

The EDA publishes the cabin temperature (degrees C) and CO2 (ppm) measured aboard the
International Space Station during each Rodent Research mission. This script writes one
row per mission and reading to data/eda/iss_cabin_by_mission.csv with the median and a
robust spread (interquartile range / 1.349, which ignores sensor drop-outs), and prints
the values the simulator uses: the median of the mission medians and of the mission
spreads, so every mission counts once however long it was.

Usage:
    python scripts/eda_cabin_summary.py                # downloads from the EDA API
    python scripts/eda_cabin_summary.py --from-dir D   # reads <mission>_<reading>_iss.json files
"""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import urllib.request
from pathlib import Path

API = "https://visualization.osdr.nasa.gov/eda/api/missions"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "eda" / "iss_cabin_by_mission.csv"
READINGS = {"temperature": "degC", "co2": "ppm"}
# The simulator's cabin pressure is 101.3 kPa, which is 760 mmHg.
MMHG_PER_PPM = 760 / 1_000_000


def fetch(url: str) -> object:
    with urllib.request.urlopen(url, timeout=180) as response:
        return json.load(response)


def quantile(sorted_values: list[float], p: float) -> float:
    k = (len(sorted_values) - 1) * p
    low = int(k)
    high = min(low + 1, len(sorted_values) - 1)
    return sorted_values[low] + (sorted_values[high] - sorted_values[low]) * (k - low)


def load(mission: str, reading: str, from_dir: Path | None) -> list[dict[str, object]]:
    if from_dir is not None:
        path = from_dir / f"{mission}_{reading}_iss.json"
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    rows = fetch(f"{API}/{mission}/{reading}/iss/")
    return rows if isinstance(rows, list) else []


def missions(from_dir: Path | None) -> list[str]:
    if from_dir is not None:
        names = {p.name.split("_")[0] for p in from_dir.glob("*_iss.json")}
        return sorted(n for n in names if n.startswith("RR-"))
    listing = fetch(f"{API}/")
    items = listing["data"] if isinstance(listing, dict) else listing
    return [m["name"] for m in items if str(m["name"]).startswith("RR-")]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--from-dir", type=Path, default=None)
    args = parser.parse_args()

    rows: list[dict[str, object]] = []
    for mission in missions(args.from_dir):
        for reading, unit in READINGS.items():
            data = load(mission, reading, args.from_dir)
            key = f"{reading}_iss"
            timed = [(r["time"], float(r[key])) for r in data if r.get(key) is not None]
            if not timed:
                continue
            values = sorted(v for _, v in timed)
            rows.append(
                {
                    "mission": mission,
                    "reading": reading,
                    "unit": unit,
                    "samples": len(values),
                    "first_utc": timed[0][0],
                    "last_utc": timed[-1][0],
                    "median": round(statistics.median(values), 2),
                    "iqr_sd": round((quantile(values, 0.75) - quantile(values, 0.25)) / 1.349, 3),
                }
            )

    order = list(READINGS)
    rows.sort(key=lambda r: (int(str(r["mission"]).split("-")[1]), order.index(str(r["reading"]))))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {OUT.relative_to(ROOT)}")

    for reading, unit in READINGS.items():
        mine = [r for r in rows if r["reading"] == reading]
        centre = statistics.median(float(r["median"]) for r in mine)
        spread = statistics.median(float(r["iqr_sd"]) for r in mine)
        line = f"{reading}: {len(mine)} missions, median {centre:.2f} {unit}"
        line += f", spread {spread:.3f} {unit}"
        if reading == "co2":
            line += f" = {centre * MMHG_PER_PPM:.2f} mmHg"
            line += f", spread {spread * MMHG_PER_PPM:.2f} mmHg"
        print(line)


if __name__ == "__main__":
    main()
