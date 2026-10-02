#!/usr/bin/env python3
"""
Enriches each submission with:
  - <question>_AnswerC    0/1 effective score
  - <question>_IsConcern  0/1 (flagged for prominence/filtering, independent of score)
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
    """Normalize a Kobo answer to 0/1. Return None for missing or invalid responses."""
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
        if cleaned in {"1", "yes", "y", "true", "t"}:
            return 1
        if cleaned in {"0", "no", "n", "false", "f"}:
            return 0
        if cleaned in {"", "na", "n/a", "none", "null"}:
            return None
        return None

    return None


def stage_from_question(q):
    """Return Startup/Implementation/Closeout based on question prefix."""
    if not q or "." not in q:
        return None
    prefix = q.split(".")[0].upper()
    return STAGE_MAP.get(prefix)


def get_question_rule(rules, key):
    """Return the canonical checklist rule for a question, whichever polarity exists."""
    return rules.get(f"{key}|0") or rules.get(f"{key}|1")


def question_is_scoreable(rules, key):
    """A question is scoreable only if at least one answer polarity is defined in rules."""
    return f"{key}|0" in rules or f"{key}|1" in rules


def score_submission(sub, rules, issue_tracking, project_lookup):
    scored = dict(sub)

    # Use kobo_name (internal project identifier) as the key for metadata joining
    project_identifier = sub.get("project")
    project_meta = project_lookup.get(project_identifier)
    
    if project_meta:
        for k, v in project_meta.items():
            scored[f"meta_{k}"] = v
    
    # Normalize project display name: use project_title if available, else fallback to project
    if project_meta and project_meta.get("project_title"):
        scored["_display_project_name"] = project_meta.get("project_title")
    else:
        scored["_display_project_name"] = project_identifier or "Unknown"

    answer_scores = []
    concerns = []
    stage_scores = {"Startup": [], "Implementation": [], "Closeout": []}
    pillar_scores = {"Programmatic": [], "MEL": []}

    for key, value in sub.items():
        if key in NON_QUESTION_FIELDS:
            continue
        if key.startswith("_") or key.startswith("meta/"):
            continue
        if not question_is_scoreable(rules, key):
            continue

        answer = to_answer(value)
        if answer is None:
            scored[f"{key}_AnswerC"] = None
            scored[f"{key}_IsConcern"] = 0
            continue

        base_rule = get_question_rule(rules, key)
        exact_rule = rules.get(f"{key}|{answer}")

        # Scoring: 1 if answer matches checklist rule, 0 otherwise
        score = 1 if exact_rule is not None else 0
        
        # Concern flag: independent of score, based on checklist marking
        is_concern = 1 if base_rule.get("is_concern") == 1 else 0
        
        rule_for_metadata = exact_rule or base_rule

        scored[f"{key}_AnswerC"] = score
        scored[f"{key}_IsConcern"] = is_concern
        answer_scores.append(score)

        stage = rule_for_metadata.get("stage") or stage_from_question(key)
        if stage in stage_scores:
            stage_scores[stage].append(score)

        pillar = rule_for_metadata.get("pillar")
        if pillar in pillar_scores:
            pillar_scores[pillar].append(score)

        # Add to concerns list if flagged as a concern (for reporting/filtering)
        if is_concern == 1:
            concerns.append({
                "question": key,
                "issue": rule_for_metadata.get("issue") or key,
                "stage": rule_for_metadata.get("stage"),
                "pillar": rule_for_metadata.get("pillar"),
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

    # Build project lookup keyed by kobo_name (the stable internal identifier)
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
