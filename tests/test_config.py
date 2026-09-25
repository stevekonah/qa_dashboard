import config


def test_kobo_config_values_are_present():
    assert config.KOBO_HOST == "kf.kobotoolbox.org"
    assert config.ASSET_UID
    assert "startup/" in config.GROUP_PREFIXES
    assert "project" in config.TOP_LEVEL_KEEP


def test_scoring_thresholds_are_consistent():
    assert config.ON_TRACK_THRESHOLD > config.NEEDS_ATTENTION_THRESHOLD > 0
    assert config.ON_TRACK_THRESHOLD == 80
    assert config.NEEDS_ATTENTION_THRESHOLD == 60
