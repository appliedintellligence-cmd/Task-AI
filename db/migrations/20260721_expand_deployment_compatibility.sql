-- EXPAND migration: safe before either the old or new backend is deployed.
--
-- This migration is intentionally idempotent. It repairs environments where
-- the 20260718 migrations have already run and completes environments where
-- they have not. Do not remove the legacy compatibility shims until the
-- separate post-deployment contract migration is approved.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS jurisdiction TEXT;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS jurisdiction TEXT,
  ADD COLUMN IF NOT EXISTS safety_level SMALLINT,
  ADD COLUMN IF NOT EXISTS assessment_status TEXT DEFAULT 'assessment_pending',
  ADD COLUMN IF NOT EXISTS legal_status TEXT,
  ADD COLUMN IF NOT EXISTS safety_status TEXT,
  ADD COLUMN IF NOT EXISTS overall_status TEXT,
  ADD COLUMN IF NOT EXISTS policy_version TEXT,
  ADD COLUMN IF NOT EXISTS validation_version TEXT,
  ADD COLUMN IF NOT EXISTS policy_sources JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS assessed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION find_similar_jobs_for_user(
  source_job_id UUID,
  owner_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID, image_url TEXT, problem TEXT, severity TEXT, difficulty TEXT,
  result_json JSONB, created_at TIMESTAMPTZ, similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  query_embedding vector(768);
BEGIN
  SELECT embedding INTO query_embedding
  FROM jobs
  WHERE jobs.id = source_job_id AND jobs.user_id = owner_id;

  IF query_embedding IS NULL THEN
    RAISE EXCEPTION 'Job not found or has no embedding';
  END IF;

  RETURN QUERY
  SELECT j.id, j.image_url, j.problem, j.severity, j.difficulty,
    j.result_json, j.created_at,
    (1 - (j.embedding <=> query_embedding))::FLOAT
  FROM jobs j
  WHERE j.id != source_job_id
    AND j.user_id = owner_id
    AND j.embedding IS NOT NULL
  ORDER BY j.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

REVOKE ALL ON FUNCTION find_similar_jobs_for_user(UUID, UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION find_similar_jobs_for_user(UUID, UUID, INT) TO service_role;

CREATE OR REPLACE FUNCTION match_messages_for_user(
  owner_id UUID,
  query_embedding vector(3072),
  match_threshold FLOAT DEFAULT 0.8,
  match_count INT DEFAULT 5
)
RETURNS TABLE (id UUID, content TEXT, result_json JSONB, similarity FLOAT)
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.content, m.result_json,
    1 - (
      m.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
    )
  FROM messages m
  JOIN chats c ON c.id = m.chat_id
  WHERE c.user_id = owner_id
    AND m.role = 'assistant'
    AND m.embedding IS NOT NULL
    AND 1 - (
      m.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
    ) > match_threshold
  ORDER BY m.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION match_messages_for_user(UUID, vector, FLOAT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION match_messages_for_user(UUID, vector, FLOAT, INT) TO service_role;

-- Compatibility shims for the old backend. Returning no rows preserves API
-- availability without restoring the legacy cross-user data exposure. Current
-- production code already skips these calls when embeddings are unavailable.
CREATE OR REPLACE FUNCTION find_similar_jobs(job_id UUID, match_count INT DEFAULT 5)
RETURNS TABLE (
  id UUID, image_url TEXT, problem TEXT, severity TEXT, difficulty TEXT,
  result_json JSONB, created_at TIMESTAMPTZ, similarity FLOAT
)
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j.id, j.image_url, j.problem, j.severity, j.difficulty,
    j.result_json, j.created_at, 0::FLOAT
  FROM jobs j
  WHERE FALSE;
$$;

CREATE OR REPLACE FUNCTION match_messages(
  query_embedding vector(3072),
  match_threshold FLOAT DEFAULT 0.8,
  match_count INT DEFAULT 5
)
RETURNS TABLE (id UUID, content TEXT, result_json JSONB, similarity FLOAT)
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.content, m.result_json, 0::FLOAT
  FROM messages m
  WHERE FALSE;
$$;

REVOKE ALL ON FUNCTION find_similar_jobs(UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION match_messages(vector, FLOAT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION find_similar_jobs(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION match_messages(vector, FLOAT, INT) TO service_role;
