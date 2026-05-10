from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"


def _run(name: str, command: list[str], cwd: Path) -> None:
    print(f"==> {name}", flush=True)
    print(f"    cwd: {cwd}", flush=True)
    print(f"    cmd: {' '.join(command)}", flush=True)
    completed = subprocess.run(command, cwd=cwd, check=False)
    if completed.returncode != 0:
        raise SystemExit(completed.returncode)


def _pnpm_command() -> str:
    executable = shutil.which("pnpm.cmd") or shutil.which("pnpm")
    if executable is None:
        raise SystemExit(
            "pnpm was not found on PATH. Install pnpm or run via Corepack before verification."
        )
    return executable


def main() -> None:
    parser = argparse.ArgumentParser(description="Run CNVN local verification suites.")
    parser.add_argument(
        "--suite",
        choices=["smoke", "full"],
        default="full",
        help="smoke runs scenario and migration tests; full runs the complete backend suite.",
    )
    parser.add_argument("--backend-only", action="store_true")
    parser.add_argument("--frontend-only", action="store_true")
    parser.add_argument("--skip-git-diff", action="store_true")
    args = parser.parse_args()

    if args.backend_only and args.frontend_only:
        parser.error("--backend-only and --frontend-only cannot be used together")

    run_backend = not args.frontend_only
    run_frontend = not args.backend_only

    if run_backend:
        if args.suite == "full":
            pytest_args = ["-m", "pytest", "-q"]
        else:
            pytest_args = [
                "-m",
                "pytest",
                "tests/scenarios",
                "tests/integration/test_alembic_migrations.py",
                "-q",
            ]
        _run("backend pytest", [sys.executable, *pytest_args], BACKEND)

    if run_frontend:
        _run("frontend build smoke", [_pnpm_command(), "run", "build"], FRONTEND)

    if not args.skip_git_diff:
        _run("git whitespace check", ["git", "diff", "--check"], ROOT)


if __name__ == "__main__":
    main()
