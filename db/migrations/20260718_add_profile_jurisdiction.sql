ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS jurisdiction TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_jurisdiction_valid'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_jurisdiction_valid
      CHECK (jurisdiction IS NULL OR jurisdiction IN ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA'))
      NOT VALID;
  END IF;
END $$;

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
