from services.cors import LOCAL_ORIGINS, allowed_origins


def test_cors_defaults_to_local_development_not_wildcard(monkeypatch):
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
    assert allowed_origins() == list(LOCAL_ORIGINS)
    assert "*" not in allowed_origins()


def test_cors_uses_explicit_deduplicated_production_allowlist(monkeypatch):
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://task.ai/, https://app.task.ai,https://task.ai")
    assert allowed_origins() == ["https://task.ai", "https://app.task.ai"]
