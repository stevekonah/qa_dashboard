# config.py — QA dashboard configuration

# --- KoboToolbox ---
KOBO_HOST = "kf.kobotoolbox.org"
ASSET_UID = "asWTVYqCQhbVbkWBukm6p8"

# Group prefixes to strip from flattened field names
GROUP_PREFIXES = [
    "startup/", "implementation/", "closeout/",
    "project_profile/", "actions_group/",
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