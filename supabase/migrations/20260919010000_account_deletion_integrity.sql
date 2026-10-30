-- Make account deletion cascade through the two early tables that were created
-- without auth.users foreign keys. Existing orphan rows are removed first so
-- the constraints can be validated safely.

DELETE FROM public.user_roles r
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.user_id);

DELETE FROM public.user_agreements a
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_roles'::regclass
      AND contype = 'f'
      AND conname = 'user_roles_user_id_fkey'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_agreements'::regclass
      AND contype = 'f'
      AND conname = 'user_agreements_user_id_fkey'
  ) THEN
    ALTER TABLE public.user_agreements
      ADD CONSTRAINT user_agreements_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
