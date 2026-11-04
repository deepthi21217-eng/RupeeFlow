/*
# Loan Notification History Table

1. New Tables
- `loan_notification_logs` — records every scheduled and sent loan payment reminder.
  - `id` (uuid, primary key)
  - `loan_id` (text, references the loan — stored as text since loans live in client localStorage, not a DB table)
  - `loan_name` (text, denormalized for email subject/body)
  - `lender` (text, denormalized)
  - `email` (text, recipient)
  - `instalment_number` (integer)
  - `emi_amount` (numeric)
  - `due_date` (date as text)
  - `reminder_days` (integer — days before due: 7, 3, 1, or 0)
  - `channel` (text: 'email' or 'sms')
  - `status` (text: 'Scheduled', 'Sent', 'Failed', 'Not Configured')
  - `provider_response` (text, nullable)
  - `scheduled_for` (timestamptz)
  - `sent_at` (timestamptz, nullable)
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `loan_notification_logs`.
- Grant CRUD to `anon` + `authenticated` — this is a single-tenant app with no sign-in, so the anon-key client must be able to read and write its own notification history.
- Allow anon + authenticated CRUD because the data is intentionally shared/public (no multi-user isolation).

3. Notes
- The deduplication constraint ensures no duplicate emails are sent for the same loan, instalment, reminder timing, and scheduled date. It is enforced both at the DB level (unique index) and in client code.
*/

CREATE TABLE IF NOT EXISTS loan_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id text NOT NULL,
  loan_name text NOT NULL,
  lender text,
  email text,
  instalment_number integer NOT NULL,
  emi_amount numeric NOT NULL DEFAULT 0,
  due_date text NOT NULL,
  reminder_days integer NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'Scheduled',
  provider_response text,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loan_notification_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON loan_notification_logs TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_notif_logs" ON loan_notification_logs;
CREATE POLICY "anon_select_notif_logs" ON loan_notification_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_notif_logs" ON loan_notification_logs;
CREATE POLICY "anon_insert_notif_logs" ON loan_notification_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_notif_logs" ON loan_notification_logs;
CREATE POLICY "anon_update_notif_logs" ON loan_notification_logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_notif_logs" ON loan_notification_logs;
CREATE POLICY "anon_delete_notif_logs" ON loan_notification_logs FOR DELETE
  TO anon, authenticated USING (true);

-- Unique index to prevent duplicate reminders for the same loan + instalment + timing + date
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_dedup
  ON loan_notification_logs (loan_id, instalment_number, channel, reminder_days, scheduled_for);
