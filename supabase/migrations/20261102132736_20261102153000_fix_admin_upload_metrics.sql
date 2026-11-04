/*
# Count private statement uploads in admin metrics

1. Modified Functions
- `admin_platform_summary` now counts rows in `statement_uploads` for the uploaded-statements metric.

2. Security
- The function remains administrator-only and returns aggregate counts only.
- It still exposes no filenames, transactions, descriptions, balances, or loan data.
*/

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
    (SELECT count(*) FROM public.statement_uploads);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_platform_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_summary() TO authenticated;
