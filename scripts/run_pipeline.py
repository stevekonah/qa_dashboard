#!/usr/bin/env python3
import subprocess, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEPS = [
    "load_scoring_files.py",
    "fetch_kobo_data.py",
    "apply_scoring.py",
    "build_schema.py",
]


def main():
    for step in STEPS:
        path = os.path.join(ROOT, "scripts", step)
        print(f"\n=== Running {step} ===")
        result = subprocess.run([sys.executable, path])
        if result.returncode != 0:
            print(f"FAILED: {step}", file=sys.stderr)
            sys.exit(result.returncode)
    print("\nPipeline complete.")


if __name__ == "__main__":
    main()