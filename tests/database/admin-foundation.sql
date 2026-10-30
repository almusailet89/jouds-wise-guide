-- Run ONLY against a fresh disposable PostgreSQL database:
-- psql -X -v ON_ERROR_STOP=1 -d <disposable-db> -f tests/database/admin-foundation.sql
-- Minimal Supabase primitives for testing this migration in isolation.
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE public.profiles (user_id UUID PRIMARY KEY);
CREATE TABLE public.user_roles (user_id UUID, role TEXT);
CREATE FUNCTION public.has_role(_user_id UUID, _role TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

\ir ../../supabase/migrations/20260919000000_app_admin_foundation.sql

INSERT INTO auth.users VALUES
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003');
INSERT INTO public.user_roles VALUES ('00000000-0000-0000-0000-000000000003', 'admin');
INSERT INTO public.app_feature_flags (key, enabled) VALUES ('chat', true);
INSERT INTO public.support_tickets (id, user_id, subject) VALUES
 ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'User one'),
 ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'User two');
INSERT INTO public.support_messages (ticket_id, sender_role, content) VALUES
 ('10000000-0000-0000-0000-000000000001', 'user', 'Private first message'),
 ('10000000-0000-0000-0000-000000000002', 'user', 'Private second message');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
DO $$
DECLARE changed INTEGER;
BEGIN
  IF (SELECT count(*) FROM public.support_tickets) <> 1 THEN RAISE EXCEPTION 'Cross-user ticket visibility'; END IF;
  IF (SELECT count(*) FROM public.support_messages) <> 1 THEN RAISE EXCEPTION 'Cross-user message visibility'; END IF;
  INSERT INTO public.support_messages(ticket_id, sender_role, content)
    VALUES ('10000000-0000-0000-0000-000000000001', 'user', 'Own reply');
  BEGIN
    INSERT INTO public.support_messages(ticket_id, sender_role, content)
      VALUES ('10000000-0000-0000-0000-000000000002', 'user', 'Wrong account');
    RAISE EXCEPTION 'Cross-user reply allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.support_messages(ticket_id, sender_role, content)
      VALUES ('10000000-0000-0000-0000-000000000001', 'admin', 'Impersonation');
    RAISE EXCEPTION 'Admin impersonation allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.support_tickets(user_id, subject)
      VALUES ('00000000-0000-0000-0000-000000000002', 'Impersonated ticket');
    RAISE EXCEPTION 'Cross-user ticket creation allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.app_feature_flags SET enabled = false WHERE key = 'chat';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Non-admin changed flags'; END IF;
  BEGIN
    INSERT INTO public.discount_codes(code, type, value) VALUES ('FREE', 'percent', 100);
    RAISE EXCEPTION 'Non-admin created discount';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.support_tickets) <> 2 THEN RAISE EXCEPTION 'Admin cannot see tickets'; END IF;
  INSERT INTO public.support_messages(ticket_id, sender_role, content)
    VALUES ('10000000-0000-0000-0000-000000000001', 'admin', 'Real admin reply');
  UPDATE public.support_tickets SET status = 'resolved' WHERE id = '10000000-0000-0000-0000-000000000001';
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin cannot resolve ticket'; END IF;
  UPDATE public.app_feature_flags SET enabled = false WHERE key = 'chat';
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin cannot change flag'; END IF;
  INSERT INTO public.discount_codes(code, type, value) VALUES ('TEST20', 'percent', 20);
  BEGIN
    INSERT INTO public.discount_codes(code, type, value) VALUES ('INVALID', 'percent', 101);
    RAISE EXCEPTION 'Invalid discount accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.discount_codes) THEN RAISE EXCEPTION 'Discount configuration leaked'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: account isolation, admin authorization, reply integrity, discount validation' AS result;
