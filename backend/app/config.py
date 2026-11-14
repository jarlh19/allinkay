"""Runtime settings, read from environment variables with safe defaults."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB = BACKEND_DIR / "data" / "local" / "allinkay.db"
OSDR_CBC_CSV = BACKEND_DIR.parent / "data" / "osdr" / "OSD-569_LSDS-7_complete_blood_count.csv"


@dataclass(frozen=True)
class Settings:
    db_path: str = str(DEFAULT_DB)
    seed: int = 2026
    tick_seconds: float = 1.0
    run_live_loop: bool = True
    career_dose_msv: float = 256.0
    scenario: str = ""
    speed: float = 3600.0
    static_dir: str = ""

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            db_path=os.environ.get("ALLINKAY_DB_PATH", str(DEFAULT_DB)),
            seed=int(os.environ.get("ALLINKAY_SEED", "2026")),
            tick_seconds=float(os.environ.get("ALLINKAY_TICK_SECONDS", "1.0")),
            run_live_loop=os.environ.get("ALLINKAY_LIVE_LOOP", "1") != "0",
            career_dose_msv=float(os.environ.get("ALLINKAY_CAREER_DOSE_MSV", "256")),
            scenario=os.environ.get("ALLINKAY_SCENARIO", ""),
            speed=float(os.environ.get("ALLINKAY_SPEED", "3600")),
            static_dir=os.environ.get("ALLINKAY_STATIC_DIR", ""),
        )
