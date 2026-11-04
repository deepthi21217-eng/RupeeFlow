/*
# Add admin setup function

1. New Functions
- `setup_initial_admin` creates the first administrator account securely. It is a SECURITY DEFINER
  function that can only be called once (when no admin exists yet). It registers a new auth user
  with the admin role and blocks any further public admin creation.

2. Security
- The function checks that no admin profile exists before proceeding.
- It is callable only via the service_role key (not exposed to anon/authenticated through grants).
- After the first admin is created, the function raises an exception on any subsequent call.
- Admin accounts are NEVER created through the public signup flow.
*/

CREATE OR REPLACE FUNCTION public.setup_initial_admin(p_email text, p_password text, p_full_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_existing_admin_count int;
  v_user_id uuid;
BEGIN
  SELECT count(*) INTO v_existing_admin_count FROM public.profiles WHERE role = 'admin';
  IF v_existing_admin_count > 0 THEN
    RAISE EXCEPTION 'An administrator account already exists. Use the admin login page instead.';
  END IF;

  IF p_email IS NULL OR p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Valid email and a password of at least 8 characters are required.';
  END IF;

  INSERT INTO auth.users (instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', lower(p_email), crypt(p_password, gen_salt('bf')), now(), jsonb_build_object('full_name', p_full_name), now(), now())
  RETURNING id INTO v_user_id;

  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (v_user_id, COALESCE(p_full_name, 'Administrator'), 'admin', true)
  ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;

  INSERT INTO public.platform_events (user_id, event_type) VALUES (v_user_id, 'admin_created');

  RETURN v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.setup_initial_admin(text, text, text) FROM PUBLIC, anon, authenticated;
