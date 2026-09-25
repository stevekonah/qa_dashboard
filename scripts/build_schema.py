#!/usr/bin/env python3
"""
Fetches the XLSForm from KoboToolbox and writes a lean schema.json.
Requires KOBO_API_TOKEN.
"""
import json, os, sys, urllib.request
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import KOBO_HOST, ASSET_UID

TOKEN = os.environ.get("KOBO_API_TOKEN", "").strip()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(ROOT, "assets")


def fetch_ssjson():
    url = f"https://{KOBO_HOST}/api/v2/assets/{ASSET_UID}/?format=ssjson"
    req = urllib.request.Request(url, headers={"Authorization": f"Token {TOKEN}"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def build_schema(ssjson):
    questions = []
    for item in ssjson.get("survey", []):
        q_type = item.get("type", "")
        name = item.get("name")
        if not name or q_type in (
            "begin_group", "end_group", "begin_repeat", "end_repeat"
        ):
            continue
        label = item.get("label", [name])
        if isinstance(label, list):
            label = label[0]
        questions.append({
            "name": name,
            "type": q_type,
            "label": label,
            "required": item.get("required", False),
        })

    choices = {}
    for choice in ssjson.get("choices", []):
        list_name = choice.get("list_name")
        if not list_name:
            continue
        label = choice.get("label", [choice.get("name")])
        if isinstance(label, list):
            label = label[0]
        choices.setdefault(list_name, []).append({
            "name": choice.get("name"),
            "label": label,
        })

    return {"questions": questions, "choices": choices}


def main():
    if not TOKEN:
        print("KOBO_API_TOKEN not set — skipping schema build", file=sys.stderr)
        return
    os.makedirs(ASSETS_DIR, exist_ok=True)
    ssjson = fetch_ssjson()
    schema = build_schema(ssjson)
    with open(os.path.join(ASSETS_DIR, "schema.json"), "w") as f:
        json.dump(schema, f, indent=1)
    print(f"Wrote schema with {len(schema['questions'])} questions")


if __name__ == "__main__":
    main()