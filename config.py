# config.py — QA dashboard configuration

# --- KoboToolbox ---
KOBO_HOST = "kf.kobotoolbox.org"
ASSET_UID = "asWTVYqCQhbVbkWBukm6p8"

# The code below strips Kobo group prefixes from flattened field names.
# Keep the longest prefixes first so they match before shorter ones.
GROUP_PREFIXES = [
    "begin_group_r9y7qKNWI/group_modulimple/group_progimple/",
    "begin_group_r9y7qKNWI/group_modulimple/group_melimple_001/",
    "begin_group_r9y7qKNWI/group_modulstart/group_progstart/",
    "begin_group_r9y7qKNWI/group_modulstart/group_melimple/",
    "startsurvey/",
    "startup/",
    "implementation/",
    "closeout/",
    "project_profile/",
    "actions_group/",
]

# Top-level fields to keep
TOP_LEVEL_KEEP = {
    "_id", "_uuid", "_submission_time", "start", "end", "today",
    "project", "country", "region", "quarter", "year",
}

# Non-question fields (excluded from scoring)
NON_QUESTION_FIELDS = {
    "start", "end", "today", "deviceid",
    "project", "project_name", "country", "region",
    "quarter", "year", "cycle", "reporting_period",
    "submission_date", "submitted_by", "supervisor_name",
    "supervisor_phone", "supervisor_level",
    "actions", "strengths", "priority_gaps",
    "supervisor_comment", "action_picture",
    "indicator_comment",
    "project_status", "technical_focus",
    "technical_focus_health", "technical_focus_climate",
    "technical_focus_leadership",
    "qa_checklist_focal", "project_director",
    "funding_source", "technical_area",
    "project_title", "serenic_code"
}

# Reverse-coded questions have their checklist score inverted before aggregation.
REVERSE_QUESTIONS = {
    "S.m.8", "S.p.7", "S.f.2", "I.m.4.3", "I.m.6.4", "I.m.9",
    "I.p.3.2", "I.p.7", "I.p.8", "I.f.2", "I.f.5.1", "I.f.7",
    "c.m.6", "c.m.9", "c.p.8", "c.p.9", "c.f.2", "c.f.9",
}

# Neutral items are shown in responses but excluded from score aggregates.
NEUTRAL_QUESTIONS = {
    "S.m.2.4", "S.m.3", "S.m.6", "S.m.7", "S.m.8.1", "S.p.1",
    "S.p.6", "S.p.6.4", "S.p.7.1", "S.f.2.1", "I.m.1.3", "I.m.3",
    "I.m.7", "I.m.9.1", "I.p.1.2", "I.p.2", "I.p.5", "I.p.7.1",
    "I.p.8.1", "I.f.6", "I.f.7.1", "c.m.2", "c.m.7", "c.m.9.1",
    "c.p.1.1", "c.p.8.1", "c.p.9.1", "c.f.8", "c.f.9.1",
}

# --- Scoring thresholds ---
ON_TRACK_THRESHOLD = 80
NEEDS_ATTENTION_THRESHOLD = 60

# --- Risk score ---
RISK_CONCERN_WEIGHT = 2
RISK_DEFICIT_WEIGHT = 10
RISK_CRITICAL_THRESHOLD = 10
RISK_HIGH_THRESHOLD = 6
RISK_MEDIUM_THRESHOLD = 3
