#!/usr/bin/env python3
"""
Pulls QA checklist submissions from KoboToolbox and writes flattened JSON.
Requires KOBO_API_TOKEN.
"""
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import KOBO_HOST, ASSET_UID, GROUP_PREFIXES, TOP_LEVEL_KEEP

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")


def get_token():
    return os.environ.get("KOBO_API_TOKEN", "").strip()


def strip_prefix(key):
    for p in GROUP_PREFIXES:
        if key.startswith(p):
            return key[len(p):]
    return key


def fetch_all():
    token = get_token()
    if not token:
        print("KOBO_API_TOKEN not set.", file=sys.stderr)
        raise SystemExit(1)

    results = []
    url = f"https://{KOBO_HOST}/api/v2/assets/{ASSET_UID}/data/?format=json&limit=1000"

    while url:
        req = urllib.request.Request(url, headers={"Authorization": f"Token {token}"})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Kobo API error {e.code}: {body}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"Unable to reach Kobo API: {e}") from e

        if not isinstance(payload, dict):
            raise RuntimeError("Unexpected Kobo response format")

        page_results = payload.get("results")
        if not isinstance(page_results, list):
            raise RuntimeError("Kobo response is missing a valid 'results' list")

        results.extend(page_results)
        url = payload.get("next")

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
            flat[flat_key] = [
                {strip_prefix(k): v for k, v in item.items()} for item in value
            ]
        else:
            flat[flat_key] = value
    return flat


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    raw = fetch_all()
    flattened = [flatten(r) for r in raw]

    with open(os.path.join(DATA_DIR, "live_submissions.json"), "w") as f:
        json.dump(flattened, f, indent=1)

    meta = {
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(flattened),
        "asset_uid": ASSET_UID,
        "source": f"https://{KOBO_HOST}/api/v2/assets/{ASSET_UID}/",
    }
    with open(os.path.join(DATA_DIR, "live_meta.json"), "w") as f:
        json.dump(meta, f, indent=1)

    print(f"Wrote {len(flattened)} submissions")


if __name__ == "__main__":
    main()
