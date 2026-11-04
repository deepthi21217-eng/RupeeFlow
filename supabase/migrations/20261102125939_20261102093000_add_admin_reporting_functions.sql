/*
# Add protected admin reporting functions

1. New Functions
- `admin_list_users` returns registration and account-status metadata only.
- `admin_platform_summary` returns platform counts and activity totals only.
- `admin_set_user_active` lets an administrator activate or deactivate an account.

2. Security
- All functions derive the caller from `auth.uid()` and require an active profile with role `admin`.
- Functions use a fixed public search path and are callable only by signed-in users.
- No function returns statements, transactions, balances, loans, repayments, or notification contents.
*/

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (id uuid, full_name text, email text, created_at timestamptz, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.is_active) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, u.email::text, p.created_at, p.is_active
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_platform_summary()
RETURNS TABLE (registered_users bigint, active_users bigint, inactive_users bigint, platform_events bigint, uploaded_statements bigint)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.is_active) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT
    (SELECT count(*) FROM public.profiles),
    (SELECT count(*) FROM public.profiles WHERE is_active),
    (SELECT count(*) FROM public.profiles WHERE NOT is_active),
    (SELECT count(*) FROM public.platform_events),
    (SELECT count(*) FROM public.platform_events WHERE event_type = 'statement_uploaded');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_active(p_user_id uuid, p_is_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.is_active) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change own account status';
  END IF;
  UPDATE public.profiles SET is_active = p_is_active, updated_at = now() WHERE id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_platform_summary() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_platform_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_active(uuid, boolean) TO authenticated;
