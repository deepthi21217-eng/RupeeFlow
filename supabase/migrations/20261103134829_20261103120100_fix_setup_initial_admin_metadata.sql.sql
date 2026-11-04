/*
# Fix setup_initial_admin to set auth provider metadata

1. Root Cause (prevention)
- The `setup_initial_admin` function creates the admin user by inserting
  directly into `auth.users`. The previous version did not set
  `raw_app_meta_data`, leaving it NULL. Supabase Auth (GoTrue) requires
  `raw_app_meta_data->>'provider'` to be set to 'email' for password-based
  sign-in to succeed. Without it, sign-in fails with "Invalid credentials"
  even though the bcrypt password hash is correct.

2. Correction
- Update the function to set:
  - `raw_app_meta_data` to '{"provider":"email","providers":["email"]}'
  - `raw_user_meta_data` to include `sub`, `email`, `email_verified`,
    and `phone_verified` alongside `full_name`.
- No other behavior, validation, one-time guard, or security property is changed.

3. Important Notes
- The existing admin account was already fixed by a separate data-only
  migration. This change ensures future invocations of the function produce
  a correctly-configured auth record.
- No existing data, users, or profiles are modified.
*/

CREATE OR REPLACE FUNCTION public.setup_initial_admin(p_email text, p_password text, p_full_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth, extensions
AS $$
DECLARE
  v_existing_admin_count integer;
  v_user_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('rupeeflow_initial_admin_setup'));

  SELECT count(*) INTO v_existing_admin_count
  FROM public.profiles
  WHERE role = 'admin';

  IF v_existing_admin_count > 0 THEN
    RAISE EXCEPTION 'An administrator account already exists.';
  END IF;

  IF p_email IS NULL OR lower(trim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'A valid administrator email address is required.';
  END IF;

  IF p_password IS NULL OR length(p_password) < 8 OR p_password !~ '[A-Za-z]' OR p_password !~ '[0-9]' THEN
    RAISE EXCEPTION 'The administrator password does not meet the minimum requirements.';
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    lower(trim(p_email)),
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', lower(trim(p_email)),
      'full_name', COALESCE(NULLIF(trim(p_full_name), ''), 'Administrator'),
      'email_verified', true,
      'phone_verified', false
    ),
    now(),
    now()
  );

  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (v_user_id, COALESCE(NULLIF(trim(p_full_name), ''), 'Administrator'), 'admin', true)
  ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;

  INSERT INTO public.platform_events (user_id, event_type)
  VALUES (v_user_id, 'admin_created');

  RETURN v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.setup_initial_admin(text, text, text) FROM PUBLIC, anon, authenticated;
