-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Jobs table
CREATE TABLE jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  image_url TEXT,
  problem TEXT,
  severity TEXT,
  difficulty TEXT,
  result_json JSONB,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cosine similarity index for fast nearest-neighbour search
CREATE INDEX ON jobs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Row-level security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own jobs" ON jobs
  FOR ALL USING (auth.uid() = user_id);

-- Storage bucket (run via Supabase dashboard or CLI)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('repair-photos', 'repair-photos', false);

-- Similarity search RPC (SECURITY DEFINER bypasses RLS so comparisons are cross-user)
CREATE OR REPLACE FUNCTION find_similar_jobs(job_id UUID, match_count INT DEFAULT 5)
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
AS $$
DECLARE
  query_embedding vector(768);
BEGIN
  SELECT embedding INTO query_embedding FROM jobs WHERE jobs.id = job_id;

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
  WHERE j.id != job_id
    AND j.embedding IS NOT NULL
  ORDER BY j.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

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

-- Add embedding column to messages for semantic search
ALTER TABLE messages ADD COLUMN IF NOT EXISTS embedding vector(768);

CREATE OR REPLACE FUNCTION match_messages(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.8,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  result_json JSONB,
  similarity float
)
LANGUAGE SQL STABLE AS $$
  SELECT id, content, result_json,
    1 - (embedding <=> query_embedding) AS similarity
  FROM messages
  WHERE role = 'assistant'
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE INDEX IF NOT EXISTS messages_embedding_idx ON messages
  USING ivfflat (embedding vector_cosine_ops)
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
