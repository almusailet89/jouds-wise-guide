-- Contracts already used by the application, missing from versioned setup.
-- Reconcile existing deployed tables/policies in staging before production.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC(14,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.app_feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  label TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL CHECK (length(trim(subject)) BETWEEN 1 AND 250),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'jood', 'admin')),
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (length(trim(code)) BETWEEN 1 AND 64),
  type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value NUMERIC(14,2) NOT NULL CHECK (value > 0 AND (type <> 'percent' OR value <= 100)),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  max_uses INTEGER CHECK (max_uses > 0),
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_messages_ticket ON public.support_messages(ticket_id, created_at);

ALTER TABLE public.app_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.app_feature_flags TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_feature_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets, public.support_messages, public.discount_codes TO authenticated;

CREATE POLICY flags_read ON public.app_feature_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY flags_admin ON public.app_feature_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY tickets_read ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY tickets_create ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'open');
CREATE POLICY tickets_admin ON public.support_tickets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY messages_read ON public.support_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
    AND (t.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY messages_create ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    (sender_role = 'user' AND EXISTS (SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()))
    OR (sender_role = 'admin' AND public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY discounts_admin ON public.discount_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- These are configuration records, not payment-provider coupons.
COMMENT ON TABLE public.discount_codes IS 'Admin-managed discount definitions; provider synchronization is required before redemption.';
COMMIT;
