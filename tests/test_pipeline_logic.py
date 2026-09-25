import importlib.util
import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_module(module_name, relative_path):
    spec = importlib.util.spec_from_file_location(
        module_name,
        os.path.join(ROOT, relative_path),
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


apply_scoring = load_module("apply_scoring", "scripts/apply_scoring.py")
fetch_kobo_data = load_module("fetch_kobo_data", "scripts/fetch_kobo_data.py")


def test_concern_flags_are_emitted():
    sub = {"project": "Alpha", "question_1": 0}
    rules = {
        "question_1|0": {
            "score": 0,
            "is_concern": 1,
            "issue": "Issue reported",
            "stage": "Startup",
            "pillar": "Programmatic",
        },
        "question_1|1": {
            "score": 1,
            "is_concern": 0,
            "issue": "",
            "stage": "Startup",
            "pillar": "Programmatic",
        },
    }

    scored = apply_scoring.score_submission(sub, rules, {}, {})

    assert scored["question_1_AnswerC"] == 0
    assert scored["question_1_IsConcern"] == 1
    assert scored["ConcernCount"] == 1


def test_non_concern_answers_are_not_flagged():
    sub = {"project": "Alpha", "question_2": 1}
    rules = {
        "question_2|0": {
            "score": 0,
            "is_concern": 0,
            "issue": "",
            "stage": "Implementation",
            "pillar": "MEL",
        },
        "question_2|1": {
            "score": 1,
            "is_concern": 0,
            "issue": "",
            "stage": "Implementation",
            "pillar": "MEL",
        },
    }

    scored = apply_scoring.score_submission(sub, rules, {}, {})

    assert scored["question_2_AnswerC"] == 1
    assert scored["question_2_IsConcern"] == 0
    assert scored["ConcernCount"] == 0


def test_missing_kobo_token_exits(monkeypatch):
    monkeypatch.delenv("KOBO_API_TOKEN", raising=False)
    with pytest.raises(SystemExit):
        fetch_kobo_data.main()

