from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
EXPAND = ROOT / "db/migrations/20260721_expand_deployment_compatibility.sql"
CONTRACT = ROOT / "db/post_deployment/20260721_contract_remove_legacy_rpcs.sql"
PRIVATE_PHOTOS = ROOT / "db/migrations/20260721_add_private_repair_photos.sql"
SCHEMA = ROOT / "db/schema.sql"
HALFVEC_FIX = ROOT / "db/migrations/20260722_fix_messages_halfvec_index.sql"
OWNERSHIP = ROOT / "db/migrations/20260718_enforce_private_record_ownership.sql"
REGISTRATION_FIX = ROOT / "db/migrations/20260806_fix_registration_profile_trigger.sql"


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


def test_private_photo_migration_is_non_destructive_and_owner_scoped():
    text = sql(PRIVATE_PHOTOS)
    assert "add column if not exists photo_path" in text
    assert "'repair-photos-private', 'repair-photos-private', false" in text
    assert "for all to service_role" in text
    assert "to authenticated" not in text
    assert "to anon" not in text
    assert "delete" not in text
    assert "update jobs" not in text


def assert_owner_scoped_halfvec_rpc(text: str):
    assert "query_embedding vector(3072)" in text
    assert "c.user_id = owner_id" in text
    comparison = (
        "m.embedding::halfvec(3072) <=> "
        "query_embedding::halfvec(3072)"
    )
    # SELECT similarity, threshold filter, and ORDER BY must all use the same
    # expression as the halfvec index while ownership remains in the query.
    assert text.count(comparison) == 3
    assert f"order by {comparison}" in text


def test_empty_database_baseline_uses_supported_3072_dimension_index():
    text = sql(SCHEMA)
    assert "messages.embedding vector(3072)" not in text  # SQL uses ALTER TABLE.
    assert "add column embedding vector(3072)" in text
    assert "(embedding::halfvec(3072)) halfvec_cosine_ops" in text
    messages_index = text.split(
        "create index if not exists messages_embedding_idx", 1
    )[1].split("with (lists = 100);", 1)[0]
    assert "embedding vector_cosine_ops" not in messages_index
    # The valid jobs vector(768) index must remain untouched.
    assert "using ivfflat (embedding vector_cosine_ops) with (lists = 100)" in text


def test_owner_scoped_rpc_matches_halfvec_expression_index():
    assert_owner_scoped_halfvec_rpc(sql(SCHEMA))
    assert_owner_scoped_halfvec_rpc(sql(OWNERSHIP))
    assert_owner_scoped_halfvec_rpc(sql(EXPAND))
    assert_owner_scoped_halfvec_rpc(sql(HALFVEC_FIX))


def test_corrective_migration_is_idempotent_and_preserves_vector_contract():
    text = sql(HALFVEC_FIX)
    assert "drop index if exists public.messages_embedding_idx" in text
    assert "create index if not exists messages_embedding_idx" in text
    assert "query_embedding vector(3072)" in text
    assert "embedding::halfvec(3072)" in text
    assert "c.user_id = owner_id" in text
    assert "grant execute on function match_messages_for_user(uuid, vector, float, int)" in text


def assert_safe_registration_trigger(text: str):
    assert "function public.handle_new_user()" in text
    assert "insert into public.profiles" in text
    assert "security definer" in text
    assert "set search_path = ''" in text
    assert "coalesce(new.email, '')" in text
    assert "'user'" in text
    assert "execute function public.handle_new_user()" in text


def test_empty_database_baseline_has_safe_registration_trigger():
    assert_safe_registration_trigger(sql(SCHEMA))


def test_registration_trigger_fix_is_idempotent_and_non_destructive():
    text = sql(REGISTRATION_FIX)
    assert text.count("begin;") == 1
    assert text.count("commit;") == 1
    assert "create table if not exists public.profiles" in text
    assert "from pg_policies" in text
    assert "from pg_policy\n" not in text
    assert text.count("add column if not exists") == 5
    assert "on conflict (id) do nothing" in text
    assert "update public.profiles" not in text
    assert "delete from" not in text
    assert_safe_registration_trigger(text)
