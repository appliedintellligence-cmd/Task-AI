-- Add owner-scoped search functions used only after the backend verifies a JWT.
-- No data is deleted or rewritten by this migration.

CREATE OR REPLACE FUNCTION find_similar_jobs_for_user(
  source_job_id UUID,
  owner_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  image_url TEXT,
  problem TEXT,
  severity TEXT,
  difficulty TEXT,
  result_json JSONB,
  created_at TIMESTAMPTZ,
  similarity FLOAT
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
  SELECT
    j.id,
    j.image_url,
    j.problem,
    j.severity,
    j.difficulty,
    j.result_json,
    j.created_at,
    (1 - (j.embedding <=> query_embedding))::FLOAT AS similarity
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
RETURNS TABLE (
  id UUID,
  content TEXT,
  result_json JSONB,
  similarity FLOAT
)
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.content, m.result_json,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM messages m
  JOIN chats c ON c.id = m.chat_id
  WHERE c.user_id = owner_id
    AND m.role = 'assistant'
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION match_messages_for_user(UUID, vector, FLOAT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION match_messages_for_user(UUID, vector, FLOAT, INT) TO service_role;

-- Prevent direct use of the legacy cross-user functions while allowing an
-- application rollout to replace them without deleting persisted records.
REVOKE ALL ON FUNCTION find_similar_jobs(UUID, INT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION match_messages(vector, FLOAT, INT) FROM PUBLIC, anon, authenticated, service_role;
