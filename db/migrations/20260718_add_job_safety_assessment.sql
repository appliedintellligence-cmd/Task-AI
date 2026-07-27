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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_safety_level_range'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_safety_level_range
      CHECK (safety_level IS NULL OR safety_level BETWEEN 1 AND 4) NOT VALID;
  END IF;
END $$;

UPDATE jobs
SET assessment_status = 'assessment_pending'
WHERE validation_version IS NULL;
