-- Set admin role for the current user
INSERT INTO public.user_roles (user_id, role)
VALUES (auth.uid(), 'admin')
ON CONFLICT (user_id, role) 
DO NOTHING;