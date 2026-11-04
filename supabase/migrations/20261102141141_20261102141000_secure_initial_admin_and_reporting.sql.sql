/*
# Secure initial administrator setup and reporting

1. Security Changes
- Lock profile role and activation fields so signed-in users cannot promote themselves or reactivate/deactivate accounts.
- Keep profile display-name editing available to the account owner.
- Harden the service-role-only first-admin function with input validation and a transaction lock so only one initial administrator can be created.

2. New Functions
- `admin_platform_metrics` returns administrator-only aggregate counts, including registered users, active/inactive users, uploaded statements, processed transactions, and platform events.
- `admin_activity_log` returns administrator-only event type and timestamp data without exposing private financial records.

3. Important Notes
- Passwords continue to be hashed by Supabase Auth's server-side `crypt` function and are never returned to the browser.
- The first administrator remains creatable only through the existing service-role-only setup process.
- No user, loan, transaction, repayment, notification, or demo data is deleted or modified.
*/

REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, updated_at) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.setup_initial_admin(p_email text, p_password text, p_full_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
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

  INSERT INTO auth.users (instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', lower(trim(p_email)), crypt(p_password, gen_salt('bf')), now(), jsonb_build_object('full_name', COALESCE(NULLIF(trim(p_full_name), ''), 'Administrator')), now(), now())
  RETURNING id INTO v_user_id;

  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (v_user_id, COALESCE(NULLIF(trim(p_full_name), ''), 'Administrator'), 'admin', true);

  INSERT INTO public.platform_events (user_id, event_type)
  VALUES (v_user_id, 'admin_created');

  RETURN v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.setup_initial_admin(text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_platform_metrics()
RETURNS TABLE (
  registered_users bigint,
  active_users bigint,
  inactive_users bigint,
  uploaded_statements bigint,
  processed_transactions bigint,
  platform_events bigint
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.is_active
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY SELECT
    (SELECT count(*) FROM public.profiles),
    (SELECT count(*) FROM public.profiles WHERE is_active),
    (SELECT count(*) FROM public.profiles WHERE NOT is_active),
    (SELECT count(*) FROM public.statement_uploads),
    (SELECT count(*) FROM public.financial_transactions),
    (SELECT count(*) FROM public.platform_events);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_activity_log()
RETURNS TABLE (event_type text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.is_active
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    SELECT events.event_type, events.created_at
    FROM public.platform_events events
    ORDER BY events.created_at DESC
    LIMIT 50;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_platform_metrics() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_activity_log() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activity_log() TO authenticated;
