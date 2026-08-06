-- Correct the Auth user -> public profile trigger used by email and OAuth signup.
-- This migration is idempotent and does not update or delete existing rows.

BEGIN;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  jurisdiction TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS jurisdiction TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users manage own profile'
  ) THEN
    CREATE POLICY "Users manage own profile" ON public.profiles
      FOR ALL USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, phone, jurisdiction)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'User'
    ),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    CASE
      WHEN NEW.raw_user_meta_data->>'jurisdiction' IN ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')
      THEN NEW.raw_user_meta_data->>'jurisdiction'
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
