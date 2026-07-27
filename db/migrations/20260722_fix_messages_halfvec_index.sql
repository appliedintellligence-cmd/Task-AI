-- Correct the 3072-dimensional message embedding index without changing the
-- stored vector type or the RPC input contract. pgvector's vector IVFFlat
-- operator class is limited to 2000 dimensions; halfvec supports this index.

DROP INDEX IF EXISTS public.messages_embedding_idx;

CREATE INDEX IF NOT EXISTS messages_embedding_idx
ON messages
USING ivfflat (
  (embedding::halfvec(3072)) halfvec_cosine_ops
)
WITH (lists = 100);

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
    1 - (
      m.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
    ) AS similarity
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

REVOKE ALL ON FUNCTION match_messages_for_user(UUID, vector, FLOAT, INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION match_messages_for_user(UUID, vector, FLOAT, INT)
  TO service_role;
