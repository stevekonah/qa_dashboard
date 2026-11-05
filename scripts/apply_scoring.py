#!/usr/bin/env python3
"""Enrich Kobo submissions with checklist scores, concerns, and project metadata."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    NON_QUESTION_FIELDS, NEUTRAL_QUESTIONS, REVERSE_QUESTIONS,
    ON_TRACK_THRESHOLD, NEEDS_ATTENTION_THRESHOLD,
    RISK_CONCERN_WEIGHT, RISK_DEFICIT_WEIGHT,
    RISK_CRITICAL_THRESHOLD, RISK_HIGH_THRESHOLD, RISK_MEDIUM_THRESHOLD,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
STAGE_MAP = {"S": "Startup", "I": "Implementation", "C": "Closeout"}


def to_answer(value):
    """Normalize a Kobo answer to 0/1; return None for missing or invalid values."""
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value) if value in (0, 1) else None
    if isinstance(value, str):
        cleaned = value.strip().lower()
        if cleaned in {"1", "yes", "y", "true", "t"}:
            return 1
        if cleaned in {"0", "no", "n", "false", "f"}:
            return 0
    return None


def stage_from_question(question):
    if not question or "." not in question:
        return None
    return STAGE_MAP.get(question.split(".")[0].upper())


def get_question_rule(rules, key):
    return rules.get(f"{key}|0") or rules.get(f"{key}|1")


def question_is_scoreable(rules, key):
    return f"{key}|0" in rules or f"{key}|1" in rules


def score_submission(sub, rules, issue_tracking, project_lookup):
    scored = dict(sub)
    project_identifier = sub.get("project")
    project_meta = project_lookup.get(project_identifier) if isinstance(project_lookup, dict) else None
    if isinstance(project_meta, dict):
        for key, value in project_meta.items():
            scored[f"meta_{key}"] = value
    scored["_display_project_name"] = (
        project_meta.get("project_title") if isinstance(project_meta, dict) and project_meta.get("project_title")
        else project_identifier or "Unknown"
    )

    answer_scores = []
    concerns = []
    stage_scores = {"Startup": [], "Implementation": [], "Closeout": []}
    pillar_scores = {"Programmatic": [], "MEL": []}

    for key, value in sub.items():
        if key in NON_QUESTION_FIELDS or key.startswith("_") or key.startswith("meta/"):
            continue
        if not question_is_scoreable(rules, key):
            continue

        answer = to_answer(value)
        if answer is None:
            scored[f"{key}_AnswerC"] = None
            scored[f"{key}_IsConcern"] = 0
            scored[f"{key}_ScoringType"] = "Neutral" if key in NEUTRAL_QUESTIONS else "Scored"
            continue

        base_rule = get_question_rule(rules, key)
        answer_rule = rules.get(f"{key}|{answer}")
        rule = answer_rule or base_rule
        if rule is None:
            scored[f"{key}_AnswerC"] = None
            scored[f"{key}_IsConcern"] = 0
            continue

        score = rule.get("score")
        # The checklist score remains the source of truth; reverse-coded items invert it.
        if key in REVERSE_QUESTIONS and score in (0, 1):
            score = 1 - score
        is_neutral = key in NEUTRAL_QUESTIONS
        is_concern = int(rule.get("is_concern") == 1)

        # Keep neutral response rows identifiable but never include them in score totals.
        scored[f"{key}_AnswerC"] = None if is_neutral else score
        scored[f"{key}_IsConcern"] = is_concern
        scored[f"{key}_ScoringType"] = "Neutral" if is_neutral else ("Reverse" if key in REVERSE_QUESTIONS else "Scored")

        if not is_neutral and score in (0, 1):
            answer_scores.append(score)
            stage = rule.get("stage") or stage_from_question(key)
            if stage in stage_scores:
                stage_scores[stage].append(score)
            pillar = rule.get("pillar")
            if pillar in pillar_scores:
                pillar_scores[pillar].append(score)

        if is_concern:
            concerns.append({
                "question": key,
                "issue": rule.get("issue") or key,
                "stage": rule.get("stage") or stage_from_question(key),
                "pillar": rule.get("pillar"),
            })
        if key in issue_tracking:
            scored[f"{key}_IssueTracking"] = issue_tracking[key]

    scored["SubmissionScore"] = round(100 * sum(answer_scores) / len(answer_scores), 1) if answer_scores else None
    scored["ConcernCount"] = len(concerns)
    scored["ConcernQuestions"] = concerns
    score = scored["SubmissionScore"]
    if score is None:
        scored["ProjectStatus"] = "No Data"
    elif score >= ON_TRACK_THRESHOLD:
        scored["ProjectStatus"] = "On Track"
    elif score >= NEEDS_ATTENTION_THRESHOLD:
        scored["ProjectStatus"] = "Needs Attention"
    else:
        scored["ProjectStatus"] = "At Risk"

    scored["RiskScore"] = round(len(concerns) * RISK_CONCERN_WEIGHT + (1 - score / 100) * RISK_DEFICIT_WEIGHT, 2) if score is not None else None
    risk = scored["RiskScore"]
    if risk is None:
        scored["RiskCategory"] = "Unknown"
    elif risk >= RISK_CRITICAL_THRESHOLD:
        scored["RiskCategory"] = "Critical"
    elif risk >= RISK_HIGH_THRESHOLD:
        scored["RiskCategory"] = "High"
    elif risk >= RISK_MEDIUM_THRESHOLD:
        scored["RiskCategory"] = "Medium"
    else:
        scored["RiskCategory"] = "Low"
    scored["RiskAlert"] = "⚠ High Risk" if score is not None and score < 60 else "OK"

    for stage, values in stage_scores.items():
        scored[f"{stage}Score"] = round(100 * sum(values) / len(values), 1) if values else None
    for pillar, values in pillar_scores.items():
        scored[f"{pillar}Score"] = round(100 * sum(values) / len(values), 1) if values else None
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
    project_lookup = {project["kobo_name"]: project for project in projects}
    scored = [score_submission(submission, rules, issue_tracking, project_lookup) for submission in submissions]
    with open(os.path.join(DATA_DIR, "live_submissions_scored.json"), "w") as f:
        json.dump(scored, f, indent=1)
    print(f"Scored {len(scored)} submissions")


if __name__ == "__main__":
    main()
