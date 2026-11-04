/*
# Add mobile_number column to loan_notification_logs

1. Modified Tables
- `loan_notification_logs` — adds nullable `mobile_number` text column to record the recipient
  phone number for SMS channel reminders. This is additive and non-destructive; existing email
  rows are unaffected.

2. Security
- No policy changes. RLS remains enabled with existing anon/authenticated CRUD grants.
*/

ALTER TABLE loan_notification_logs
  ADD COLUMN IF NOT EXISTS mobile_number text;
