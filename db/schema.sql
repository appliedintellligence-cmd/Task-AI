-- Jobs table
CREATE TABLE jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  image_url TEXT,
  problem TEXT,
  severity TEXT,
  difficulty TEXT,
  result_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row-level security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own jobs" ON jobs
  FOR ALL USING (auth.uid() = user_id);

-- Storage bucket (run via Supabase dashboard or CLI)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('repair-photos', 'repair-photos', false);
