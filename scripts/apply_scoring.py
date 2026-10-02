#!/usr/bin/env python3
"""
Enriches each submission with:
  - <question>_AnswerC    0/1 effective score
  - <question>_IsConcern  0/1
  - <question>_IssueTracking  str (only for open-ended concern questions)
  - SubmissionScore, ConcernCount, ConcernQuestions
  - ProjectStatus, RiskScore, RiskCategory, RiskAlert
  - ProgrammaticScore, MELScore
  - StartupScore, ImplementationScore, CloseoutScore
  - meta_* (project metadata)
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    NON_QUESTION_FIELDS,
    ON_TRACK_THRESHOLD, NEEDS_ATTENTION_THRESHOLD,
    RISK_CONCERN_WEIGHT, RISK_DEFICIT_WEIGHT,
    RISK_CRITICAL_THRESHOLD, RISK_HIGH_THRESHOLD, RISK_MEDIUM_THRESHOLD,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")

STAGE_MAP = {
    "S": "Startup",
    "I": "Implementation",
    "C": "Closeout",
}


def to_answer(value):
    if value is None:
        return None

    if isinstance(value, bool):
        return int(value)

    if isinstance(value, (int, float)):
        if value in (0, 1):
            return int(value)
        return None

    if isinstance(value, str):
        cleaned = value.strip().lower()
        if cleaned in {"1", "yes", "y", "true"}:
            return 1
        if cleaned in {"0", "no", "n", "false"}:
            return 0
        return None

    return None


def stage_from_question(q):
    """Return Startup/Implementation/Closeout based on question prefix."""
    if not q or "." not in q:
        return None
    prefix = q.split(".")[0].upper()
    return STAGE_MAP.get(prefix)


def find_question_rule(rules, key):
    """Return the checklist rule for a question, preferring the explicit 0/1 key that exists."""
    return rules.get(f"{key}|0") or rules.get(f"{key}|1")


def score_submission(sub, rules, issue_tracking, project_lookup):
    scored = dict(sub)

    project_meta = project_lookup.get(sub.get("project"))
    if project_meta:
        for k, v in project_meta.items():
            scored[f"meta_{k}"] = v

    answer_scores = []
    concerns = []
    stage_scores = {"Startup": [], "Implementation": [], "Closeout": []}
    pillar_scores = {"Programmatic": [], "MEL": []}

    for key, value in sub.items():
        if key in NON_QUESTION_FIELDS:
            continue
        if key.startswith("_") or key.startswith("meta/"):
            continue

        base_rule = find_question_rule(rules, key)
        if base_rule is None:
            continue

        answer = to_answer(value)
        if answer is None:
            scored[f"{key}_AnswerC"] = None
            scored[f"{key}_IsConcern"] = 0
            continue

        rule = rules.get(f"{key}|{answer}")
        if rule is not None:
            score = 1
            is_concern = 0
        else:
            score = 0
            is_concern = 1 if base_rule.get("is_concern") == 1 else 0

        scored[f"{key}_AnswerC"] = score
        scored[f"{key}_IsConcern"] = is_concern
        answer_scores.append(score)

        stage = base_rule.get("stage") or stage_from_question(key)
        if stage in stage_scores:
            stage_scores[stage].append(score)

        pillar = base_rule.get("pillar")
        if pillar in pillar_scores:
            pillar_scores[pillar].append(score)

        if is_concern == 1:
            concerns.append({
                "question": key,
                "issue": base_rule.get("issue") or key,
                "stage": base_rule.get("stage"),
                "pillar": base_rule.get("pillar"),
            })

        if key in issue_tracking:
            scored[f"{key}_IssueTracking"] = issue_tracking[key]

    scored["SubmissionScore"] = (
        round(100 * sum(answer_scores) / len(answer_scores), 1)
        if answer_scores else None
    )
    scored["ConcernCount"] = len(concerns)
    scored["ConcernQuestions"] = concerns

    s = scored["SubmissionScore"]
    if s is None:
        scored["ProjectStatus"] = "No Data"
    elif s >= ON_TRACK_THRESHOLD:
        scored["ProjectStatus"] = "On Track"
    elif s >= NEEDS_ATTENTION_THRESHOLD:
        scored["ProjectStatus"] = "Needs Attention"
    else:
        scored["ProjectStatus"] = "At Risk"

    if s is not None:
        scored["RiskScore"] = round(
            (len(concerns) * RISK_CONCERN_WEIGHT)
            + ((1 - s / 100) * RISK_DEFICIT_WEIGHT),
            2,
        )
    else:
        scored["RiskScore"] = None

    rs = scored["RiskScore"]
    if rs is None:
        scored["RiskCategory"] = "Unknown"
    elif rs >= RISK_CRITICAL_THRESHOLD:
        scored["RiskCategory"] = "Critical"
    elif rs >= RISK_HIGH_THRESHOLD:
        scored["RiskCategory"] = "High"
    elif rs >= RISK_MEDIUM_THRESHOLD:
        scored["RiskCategory"] = "Medium"
    else:
        scored["RiskCategory"] = "Low"

    scored["RiskAlert"] = "⚠ High Risk" if (s is not None and s < 60) else "OK"

    for stage, arr in stage_scores.items():
        scored[f"{stage}Score"] = (
            round(100 * sum(arr) / len(arr), 1) if arr else None
        )

    for pillar, arr in pillar_scores.items():
        scored[f"{pillar}Score"] = (
            round(100 * sum(arr) / len(arr), 1) if arr else None
        )

    return scored


def main():
    with open(os.path.join(DATA_DIR, "live_submissions.json")) as f:
        submissions = json.load(f)
    with open(os.path.join(DATA_DIR, "scoring_rules.json")) as f:
        rules = json.load(f)
    with open(os.path.join(DATA_DIR, "issue_tracking.json")) as f:
        issue_tracking = json.load(f)
    with open(os.path.join(DATA_DIR, "active_projects.json")) as f:
        projects = json.load(f)

    project_lookup = {p["kobo_name"]: p for p in projects}

    scored = [
        score_submission(s, rules, issue_tracking, project_lookup)
        for s in submissions
    ]

    with open(os.path.join(DATA_DIR, "live_submissions_scored.json"), "w") as f:
        json.dump(scored, f, indent=1)
    print(f"Scored {len(scored)} submissions")


if __name__ == "__main__":
    main()
