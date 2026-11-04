/*
# Recover administrator credentials

1. Purpose
- The administrator has forgotten their password and requested a credential
  recovery. This migration updates ONLY the existing administrator account.
- No new account is created. No other user, transaction, loan, repayment,
  notification, or profile record is touched.

2. Changes
- Update the existing admin row in auth.users:
  - email → 'rupeeflow.admin@gmail.com' (lowercased)
  - encrypted_password → bcrypt hash of the new password using crypt() + gen_salt('bf')
  - raw_user_meta_data → updated email field to match
  - updated_at → now()
- The profile row (role='admin', is_active=true) is not modified.

3. Security
- Password is hashed server-side with bcrypt via PostgreSQL's pgcrypto.
- The password is never stored in plaintext.
- The admin role and is_active flag remain unchanged.
- No RLS policies, grants, or application code are altered.
*/

UPDATE auth.users
SET
  email = 'rupeeflow.admin@gmail.com',
  encrypted_password = crypt('Admin2026@27', gen_salt('bf')),
  raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{email}',
    '"rupeeflow.admin@gmail.com"'
  ),
  updated_at = now()
WHERE id = 'df3aa482-2bcf-4849-a59e-ff414784c49d'
  AND email = 'admin@rupeeflow.app';
