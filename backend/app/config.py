"""Runtime settings, read from environment variables with safe defaults."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB = BACKEND_DIR / "data" / "local" / "allinkay.db"


@dataclass(frozen=True)
class Settings:
    db_path: str = str(DEFAULT_DB)
    seed: int = 2026
    tick_seconds: float = 1.0
    run_live_loop: bool = True

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            db_path=os.environ.get("ALLINKAY_DB_PATH", str(DEFAULT_DB)),
            seed=int(os.environ.get("ALLINKAY_SEED", "2026")),
            tick_seconds=float(os.environ.get("ALLINKAY_TICK_SECONDS", "1.0")),
            run_live_loop=os.environ.get("ALLINKAY_LIVE_LOOP", "1") != "0",
        )
