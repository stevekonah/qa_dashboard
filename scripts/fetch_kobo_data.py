#!/usr/bin/env python3
"""Pull QA checklist submissions from KoboToolbox and write flattened JSON safely."""

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import ASSET_UID, GROUP_PREFIXES, KOBO_HOST, TOP_LEVEL_KEEP

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")


def get_token():
    return os.environ.get("KOBO_API_TOKEN", "").strip()


def strip_prefix(key):
    matches = [p for p in GROUP_PREFIXES if key.startswith(p)]
    if not matches:
        return key
    return key[len(max(matches, key=len)):]


def backup_existing(path):
    if not os.path.exists(path):
        return
    backup_path = f"{path}.bak"
    with open(path, "rb") as src, open(backup_path, "wb") as dst:
        dst.write(src.read())


def atomic_write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp_path = f"{path}.tmp"
    with open(temp_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=1)
        handle.write("\n")
    os.replace(temp_path, path)


def fetch_all(max_retries=3, base_delay=1.0):
    token = get_token()
    if not token:
        print("KOBO_API_TOKEN not set.", file=sys.stderr)
        raise SystemExit(1)

    results = []
    url = f"https://{KOBO_HOST}/api/v2/assets/{ASSET_UID}/data/?format=json&limit=1000"

    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers={"Authorization": f"Token {token}"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError) as exc:
            if attempt < max_retries - 1:
                wait = base_delay * (2 ** attempt)
                print(f"Kobo fetch failed (attempt {attempt + 1}/{max_retries}), retrying in {wait}s: {exc}", file=sys.stderr)
                time.sleep(wait)
                continue
            raise RuntimeError(f"Unable to fetch Kobo data after {max_retries} attempts: {exc}") from exc

        if not isinstance(payload, dict):
            raise RuntimeError("Unexpected Kobo response format")

        page_results = payload.get("results")
        if not isinstance(page_results, list):
            raise RuntimeError("Kobo response is missing a valid 'results' list")

        results.extend(page_results)
        url = payload.get("next")
        if not url:
            break

    return results


def flatten(raw):
    flat = {}
    if not isinstance(raw, dict):
        return flat

    for key, value in raw.items():
        if key.startswith("_") and key not in TOP_LEVEL_KEEP:
            continue
        if key in ("formhub/uuid", "meta/instanceID", "__version__"):
            continue

        flat_key = strip_prefix(key)
        if isinstance(value, list) and flat_key == "actions":
            flat[flat_key] = [{strip_prefix(k): v for k, v in item.items()} for item in value]
        else:
            flat[flat_key] = value

    return flat


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    raw = fetch_all()
    flattened = [flatten(r) for r in raw]

    submissions_path = os.path.join(DATA_DIR, "live_submissions.json")
    meta_path = os.path.join(DATA_DIR, "live_meta.json")

    backup_existing(submissions_path)
    backup_existing(meta_path)
    atomic_write_json(submissions_path, flattened)

    meta = {
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(flattened),
        "asset_uid": ASSET_UID,
        "source": f"https://{KOBO_HOST}/api/v2/assets/{ASSET_UID}/",
    }
    atomic_write_json(meta_path, meta)

    print(f"Wrote {len(flattened)} submissions")


if __name__ == "__main__":
    main()
