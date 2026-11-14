"""Run the whole app locally with the demo mission, no internet needed.

Usage: python scripts/demo.py [--port 8000] [--speed 3600]
Builds the frontend first if it was never built.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
DIST = FRONTEND / "dist"


def backend_python() -> str:
    for candidate in (
        ROOT / "backend" / ".venv" / "Scripts" / "python.exe",
        ROOT / "backend" / ".venv" / "bin" / "python",
    ):
        if candidate.exists():
            return str(candidate)
    return sys.executable


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--speed", type=float, default=3600)
    args = parser.parse_args()

    if not (DIST / "index.html").exists():
        npm = shutil.which("npm")
        if npm is None:
            raise SystemExit("npm was not found; build the frontend with: npm run build --prefix frontend")
        subprocess.run([npm, "run", "build"], cwd=FRONTEND, check=True)

    env = {
        **os.environ,
        "ALLINKAY_STATIC_DIR": str(DIST),
        "ALLINKAY_SCENARIO": "demo",
        "ALLINKAY_SPEED": str(args.speed),
        "ALLINKAY_DB_PATH": ":memory:",
    }
    command = [
        backend_python(),
        "-m",
        "uvicorn",
        "app.main:create_app",
        "--factory",
        "--app-dir",
        str(ROOT / "backend"),
        "--host",
        "127.0.0.1",
        "--port",
        str(args.port),
    ]
    print(f"ALLINKAY demo on http://127.0.0.1:{args.port}", flush=True)
    raise SystemExit(subprocess.run(command, env=env, check=False).returncode)


if __name__ == "__main__":
    main()
