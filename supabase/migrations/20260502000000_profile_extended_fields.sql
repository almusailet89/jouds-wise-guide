-- Extend profiles table with full user details
-- gender is critical: Jood uses it for Arabic grammatical gender

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender        TEXT    CHECK (gender IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS phone         TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS city          TEXT,
  ADD COLUMN IF NOT EXISTS nationality   TEXT    DEFAULT 'SA',
  ADD COLUMN IF NOT EXISTS avatar_emoji  TEXT    DEFAULT '🌟',
  ADD COLUMN IF NOT EXISTS bio           TEXT;

-- Ensure display_name, gender, phone are captured at signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, gender, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.raw_user_meta_data ->> 'gender',
    NEW.raw_user_meta_data ->> 'phone'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    gender       = COALESCE(EXCLUDED.gender, profiles.gender),
    phone        = COALESCE(EXCLUDED.phone,  profiles.phone);
  RETURN NEW;
END;
$$;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
