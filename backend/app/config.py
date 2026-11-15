"""Runtime settings, read from environment variables with safe defaults."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB = BACKEND_DIR / "data" / "local" / "allinkay.db"
DATA_DIR = BACKEND_DIR.parent / "data"
OSDR_CBC_CSV = DATA_DIR / "osdr" / "OSD-569_LSDS-7_complete_blood_count.csv"
OSDR_CMP_CSV = DATA_DIR / "osdr" / "OSD-575_LSDS-8_comprehensive_metabolic_panel.csv"
DONKI_SEP_JSON = DATA_DIR / "donki" / "DONKI_SEP_2012-03-01_2012-04-29.json"
DONKI_FLR_JSON = DATA_DIR / "donki" / "DONKI_FLR_2012-03-07.json"
RAD_DOSE_CSV = DATA_DIR / "rad" / "MSL_RAD_cruise_dose_2012-02-28_2012-03-15.csv"


@dataclass(frozen=True)
class Settings:
    db_path: str = str(DEFAULT_DB)
    seed: int = 2026
    tick_seconds: float = 1.0
    run_live_loop: bool = True
    scenario: str = ""
    speed: float = 3600.0
    static_dir: str = ""
    github_token: str = ""
    github_repo: str = "jarlh19/allinkay"
    reports_export: bool = False

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            db_path=os.environ.get("ALLINKAY_DB_PATH", str(DEFAULT_DB)),
            seed=int(os.environ.get("ALLINKAY_SEED", "2026")),
            tick_seconds=float(os.environ.get("ALLINKAY_TICK_SECONDS", "1.0")),
            run_live_loop=os.environ.get("ALLINKAY_LIVE_LOOP", "1") != "0",
            scenario=os.environ.get("ALLINKAY_SCENARIO", ""),
            speed=float(os.environ.get("ALLINKAY_SPEED", "3600")),
            static_dir=os.environ.get("ALLINKAY_STATIC_DIR", ""),
            github_token=os.environ.get("ALLINKAY_GITHUB_TOKEN", ""),
            github_repo=os.environ.get("ALLINKAY_GITHUB_REPO", "jarlh19/allinkay"),
            reports_export=os.environ.get("ALLINKAY_REPORTS_EXPORT", "0") == "1",
        )
