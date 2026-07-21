from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
EXPAND = ROOT / "db/migrations/20260721_expand_deployment_compatibility.sql"
CONTRACT = ROOT / "db/post_deployment/20260721_contract_remove_legacy_rpcs.sql"


def sql(path: Path) -> str:
    return path.read_text(encoding="utf-8").lower()


def test_expand_is_additive_and_keeps_secure_legacy_shims():
    text = sql(EXPAND)
    assert "add column if not exists" in text
    assert "find_similar_jobs_for_user" in text
    assert "match_messages_for_user" in text
    assert "j.user_id = owner_id" in text
    assert "c.user_id = owner_id" in text
    assert "create or replace function find_similar_jobs(" in text
    assert "create or replace function match_messages(" in text
    assert text.count("where false") == 2
    assert "grant execute on function find_similar_jobs(uuid, int) to service_role" in text
    assert "grant execute on function match_messages(vector, float, int) to service_role" in text
    assert "drop function" not in text


def test_contract_is_outside_automatic_migration_directory_and_removes_only_legacy_rpcs():
    text = sql(CONTRACT)
    assert CONTRACT.parent.name == "post_deployment"
    assert "do not apply with expand migrations" in text
    assert "drop function if exists find_similar_jobs(uuid, int)" in text
    assert "drop function if exists match_messages(vector, float, int)" in text
    assert "find_similar_jobs_for_user" not in text
    assert "match_messages_for_user" not in text
