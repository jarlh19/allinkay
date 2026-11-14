"""Run every quality check the project requires before a commit.

Usage: python scripts/verify.py [--skip-gitleaks] [--skip-frontend]
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
LOCAL_GITLEAKS = Path("C:/Users/ASUS/herramientas/gitleaks-8.30.1/gitleaks.exe")


def backend_python() -> str:
    for candidate in (BACKEND / ".venv" / "Scripts" / "python.exe", BACKEND / ".venv" / "bin" / "python"):
        if candidate.exists():
            return str(candidate)
    return sys.executable


def npm() -> str:
    found = shutil.which("npm")
    if not found:
        raise SystemExit("npm was not found on PATH")
    return found


def gitleaks() -> str | None:
    if env := os.environ.get("GITLEAKS"):
        return env
    found = shutil.which("gitleaks")
    if found:
        return found
    return str(LOCAL_GITLEAKS) if LOCAL_GITLEAKS.exists() else None


def run(name: str, command: list[str], cwd: Path) -> None:
    print(f"\n==> {name}", flush=True)
    result = subprocess.run(command, cwd=cwd, check=False)
    if result.returncode != 0:
        raise SystemExit(f"FAILED: {name} (exit code {result.returncode})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-gitleaks", action="store_true")
    parser.add_argument("--skip-frontend", action="store_true")
    args = parser.parse_args()

    py = backend_python()
    run("ruff check", [py, "-m", "ruff", "check", "."], BACKEND)
    run("ruff format", [py, "-m", "ruff", "format", "--check", "."], BACKEND)
    run("pytest", [py, "-m", "pytest"], BACKEND)

    if not args.skip_frontend:
        run("eslint", [npm(), "run", "lint"], FRONTEND)
        run("vitest", [npm(), "test", "--", "--run"], FRONTEND)
        run("build", [npm(), "run", "build"], FRONTEND)

    if not args.skip_gitleaks:
        binary = gitleaks()
        if binary is None:
            raise SystemExit("gitleaks was not found; set GITLEAKS or use --skip-gitleaks")
        run("gitleaks", [binary, "git", ".", "--redact", "--no-banner"], ROOT)

    print("\nAll checks passed.")


if __name__ == "__main__":
    main()
