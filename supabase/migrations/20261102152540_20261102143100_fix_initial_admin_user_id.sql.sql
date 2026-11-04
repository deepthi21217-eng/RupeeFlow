/*
# Fix initial administrator identity creation

1. Modified Function
- `setup_initial_admin(text, text, text)` now supplies the required UUID for the new `auth.users` row.
- The existing one-time administrator check, email/password validation, server-side bcrypt hashing, profile role assignment, and activity event are preserved.

2. Security
- The function remains `SECURITY DEFINER` and is not executable by `anon` or `authenticated` users.
- The UUID is generated inside PostgreSQL; no identity or credential is supplied by the frontend.
- No existing users, financial transactions, tables, RLS policies, or application modules are modified.

3. Important Notes
- Earlier failed attempts were rolled back by PostgreSQL and created no partial administrator.
- This change only allows the already-created function to satisfy the required `auth.users.id` field.
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

  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', lower(trim(p_email)), crypt(p_password, gen_salt('bf')), now(), jsonb_build_object('full_name', COALESCE(NULLIF(trim(p_full_name), ''), 'Administrator')), now(), now());

  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (v_user_id, COALESCE(NULLIF(trim(p_full_name), ''), 'Administrator'), 'admin', true)
  ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;

  INSERT INTO public.platform_events (user_id, event_type)
  VALUES (v_user_id, 'admin_created');

  RETURN v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.setup_initial_admin(text, text, text) FROM PUBLIC, anon, authenticated;
