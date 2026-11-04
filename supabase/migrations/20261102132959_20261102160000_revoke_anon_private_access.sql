/*
# Revoke anonymous access from all private tables

1. Security Changes
- Revoke all privileges from the `anon` role on every private table: profiles, loans, repayments, in_app_notifications, platform_events, financial_transactions, statement_uploads, and the legacy loan_notification_logs.
- Replace the legacy open-access policies on loan_notification_logs with authenticated-only, owner-scoped policies. Since legacy rows have no user_id, they remain inaccessible to all clients; new rows written by authenticated edge functions will include user_id when applicable.
- Add a user_id column to loan_notification_logs (nullable) so future logs can be owner-scoped.

2. Important Notes
- RLS was already blocking anon access (no matching policies), so this is defense-in-depth, not a fix for a live vulnerability.
- Existing loan_notification_logs rows are not deleted; they simply become invisible to client queries because they lack a user_id.
- No data is lost; no columns are dropped or renamed.
*/

ALTER TABLE public.loan_notification_logs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.loans FROM anon;
REVOKE ALL ON public.repayments FROM anon;
REVOKE ALL ON public.in_app_notifications FROM anon;
REVOKE ALL ON public.platform_events FROM anon;
REVOKE ALL ON public.financial_transactions FROM anon;
REVOKE ALL ON public.statement_uploads FROM anon;
REVOKE ALL ON public.loan_notification_logs FROM anon;

DROP POLICY IF EXISTS "anon_select_notif_logs" ON public.loan_notification_logs;
DROP POLICY IF EXISTS "anon_insert_notif_logs" ON public.loan_notification_logs;
DROP POLICY IF EXISTS "anon_update_notif_logs" ON public.loan_notification_logs;
DROP POLICY IF EXISTS "anon_delete_notif_logs" ON public.loan_notification_logs;

CREATE POLICY "notif_logs_select_own" ON public.loan_notification_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_logs_insert_own" ON public.loan_notification_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_logs_update_own" ON public.loan_notification_logs
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_logs_delete_own" ON public.loan_notification_logs
  FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_notification_logs TO authenticated;
