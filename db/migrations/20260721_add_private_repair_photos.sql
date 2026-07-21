-- EXPAND migration for new private repair photos.
-- Existing image_url values and existing storage objects are left untouched.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS photo_path TEXT,
  ADD COLUMN IF NOT EXISTS photo_storage TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_photo_storage_valid'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_photo_storage_valid
      CHECK (photo_storage IS NULL OR photo_storage IN ('private', 'legacy_public'))
      NOT VALID;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('repair-photos-private', 'repair-photos-private', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- The backend is the only storage principal. Browser/mobile clients receive a
-- short-lived signed URL after the application verifies both job and owner.
-- No anon or authenticated storage.objects policy is created for this bucket.
DROP POLICY IF EXISTS "Backend manages private repair photos" ON storage.objects;
CREATE POLICY "Backend manages private repair photos"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'repair-photos-private')
WITH CHECK (bucket_id = 'repair-photos-private');
