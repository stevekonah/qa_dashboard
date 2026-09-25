#!/usr/bin/env python3
"""
Reads scoring/Scoring Checklist.xlsx:
  - Sheet1 (Scoring Checklist) → data/scoring_rules.json
  - Sheet2 (Active Projects)    → data/active_projects.json
  - Sheet3 (Issues)             → data/issue_tracking.json
"""
import json, os, sys
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCORING_FILE = os.path.join(ROOT, "scoring", "Scoring Checklist.xlsx")
DATA_DIR = os.path.join(ROOT, "data")


def read_sheet(wb, sheet_name):
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(h).strip() if h is not None else "" for h in rows[0]]
    return [dict(zip(headers, row)) for row in rows[1:] if any(row)]


def parse_scoring_sheet(rows):
    rules = {}
    for row in rows:
        q = row.get("Question")
        a = row.get("Answer")
        if q is None or a is None:
            continue
        q = str(q).strip()
        try:
            a = int(a)
        except (ValueError, TypeError):
            continue

        score = row.get("Score")
        score = int(score) if score in (0, 1, "0", "1") else None

        isc = str(row.get("IsConcern", "No")).strip().lower()
        is_concern = 1 if isc == "yes" else 0

        section = str(row.get("Checklist_Section", "")).strip()
        if "-" in section:
            stage, pillar = section.split("-", 1)
            stage, pillar = stage.strip(), pillar.strip()
        else:
            stage, pillar = section, ""

        rules[f"{q}|{a}"] = {
            "score": score,
            "is_concern": is_concern,
            "issue": str(row.get("Issue_Reported", "")).strip(),
            "stage": stage,
            "pillar": pillar,
            "question_label": str(row.get("Question_label", "")).strip(),
        }
    return rules


def parse_active_projects(rows):
    projects = []
    for row in rows:
        kobo = row.get("Kobo_Name")
        if not kobo:
            continue
        projects.append({
            "kobo_name": str(kobo).strip(),
            "region": row.get("Region"),
            "country": row.get("Country"),
            "serenic_code": row.get("Serenic Code"),
            "project_title": row.get("Project Title"),
            "project_lead": row.get("Project Lead Name"),
            "qa_focal": row.get("QA Focal Person"),
            "start_date": str(row.get("Start Date") or ""),
            "end_date": str(row.get("End Date") or ""),
            "amount": row.get("Amount"),
            "funding_source": row.get("Funding Source"),
            "technical_area": row.get("Technical Area"),
        })
    return projects


def parse_issues(rows):
    mapping = {}
    for row in rows:
        q = row.get("Question")
        if not q:
            continue
        mapping[str(q).strip()] = str(row.get("Issue_Tracking", "")).strip()
    return mapping


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(SCORING_FILE):
        print(f"ERROR: {SCORING_FILE} not found", file=sys.stderr)
        sys.exit(1)

    wb = openpyxl.load_workbook(SCORING_FILE, data_only=True)

    rules = parse_scoring_sheet(read_sheet(wb, "Sheet1"))
    with open(os.path.join(DATA_DIR, "scoring_rules.json"), "w") as f:
        json.dump(rules, f, indent=1)
    print(f"Wrote {len(rules)} scoring rule entries")

    projects = parse_active_projects(read_sheet(wb, "Sheet2"))
    with open(os.path.join(DATA_DIR, "active_projects.json"), "w") as f:
        json.dump(projects, f, indent=1)
    print(f"Wrote {len(projects)} active projects")

    issues = parse_issues(read_sheet(wb, "Issues"))
    with open(os.path.join(DATA_DIR, "issue_tracking.json"), "w") as f:
        json.dump(issues, f, indent=1)
    print(f"Wrote {len(issues)} issue tracking entries")


if __name__ == "__main__":
    main()