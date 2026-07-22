-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Jobs table
CREATE TABLE jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  image_url TEXT,
  photo_path TEXT,
  photo_storage TEXT CHECK (photo_storage IN ('private', 'legacy_public')),
  problem TEXT,
  severity TEXT,
  difficulty TEXT,
  result_json JSONB,
  jurisdiction TEXT,
  safety_level SMALLINT,
  assessment_status TEXT DEFAULT 'assessment_pending',
  legal_status TEXT,
  safety_status TEXT,
  overall_status TEXT,
  policy_version TEXT,
  validation_version TEXT,
  policy_sources JSONB DEFAULT '[]'::jsonb,
  assessed_at TIMESTAMPTZ,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cosine similarity index for fast nearest-neighbour search
CREATE INDEX ON jobs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Row-level security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own jobs" ON jobs
  FOR ALL USING (auth.uid() = user_id);

-- Legacy storage bucket (do not use for new uploads or make public)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('repair-photos', 'repair-photos', false);

-- New private storage bucket. New database installations should also apply
-- db/migrations/20260721_add_private_repair_photos.sql for ownership policy.
INSERT INTO storage.buckets (id, name, public)
VALUES ('repair-photos-private', 'repair-photos-private', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Backend-only similarity search. Both the source and candidates must have the
-- authenticated owner supplied by the backend after JWT verification.
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

-- Chat history tables
CREATE TABLE chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user','assistant')),
  content TEXT,
  image_url TEXT,
  result_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own chats" ON chats
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own messages" ON messages
  FOR ALL USING (
    chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid())
  );

-- Add embedding column to messages for semantic search (3072-dim: gemini-embedding-001)
ALTER TABLE messages DROP COLUMN IF EXISTS embedding;
ALTER TABLE messages ADD COLUMN embedding vector(3072);

DROP FUNCTION IF EXISTS match_messages_for_user;
CREATE OR REPLACE FUNCTION match_messages_for_user(
  owner_id UUID,
  query_embedding vector(3072),
  match_threshold float DEFAULT 0.8,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  result_json JSONB,
  similarity float
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

REVOKE ALL ON FUNCTION match_messages_for_user(UUID, vector, FLOAT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION match_messages_for_user(UUID, vector, FLOAT, INT) TO service_role;

CREATE INDEX IF NOT EXISTS messages_embedding_idx ON messages
  USING ivfflat (
    (embedding::halfvec(3072)) halfvec_cosine_ops
  )
  WITH (lists = 100);

-- Migration: add embedding column to existing jobs table
-- ALTER TABLE jobs ADD COLUMN embedding vector(768);
-- CREATE INDEX ON jobs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  jurisdiction TEXT CHECK (jurisdiction IN ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name, phone, jurisdiction)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'phone',
    CASE
      WHEN NEW.raw_user_meta_data->>'jurisdiction' IN ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')
      THEN NEW.raw_user_meta_data->>'jurisdiction'
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
