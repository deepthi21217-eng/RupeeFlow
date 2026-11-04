/*
# Fix administrator account authentication metadata

1. Root Cause
- The existing administrator account (admin@rupeeflow.app) was created by the
  `setup_initial_admin` SECURITY DEFINER function, which inserts directly into
  `auth.users`. That function set `encrypted_password` and `raw_user_meta_data`
  but left `raw_app_meta_data` as NULL and omitted several fields that Supabase
  Auth (GoTrue) requires for email/password sign-in.
- Specifically, GoTrue's password sign-in checks the user's authentication
  provider via `raw_app_meta_data->>'provider'`. When that value is NULL
  (no provider), GoTrue rejects the sign-in with "Invalid credentials" even
  though the bcrypt password hash is valid.
- Normal users created through the public sign-up flow have
  `raw_app_meta_data = '{"provider":"email","providers":["email"]}'` and
  `raw_user_meta_data` that includes `sub`, `email`, `email_verified`, and
  `phone_verified`.

2. Correction
- Update ONLY the existing administrator record in `auth.users` to set:
  - `raw_app_meta_data` to '{"provider":"email","providers":["email"]}'
  - `raw_user_meta_data` to include `sub`, `email`, `email_verified`, and
    `phone_verified` alongside the existing `full_name`.
- No password hash is changed. No new account is created. No other user,
  transaction, loan, repayment, notification, or profile record is touched.

3. Reversibility
- The previous state (NULL raw_app_meta_data, partial raw_user_meta_data) is
  documented here. Reverting would set raw_app_meta_data back to NULL, which
  would re-introduce the login failure.

4. Important Notes
- This is a data-only correction limited to the single existing admin row.
- The bcrypt password hash is NOT modified — the admin's existing password
  continues to work unchanged.
- No RLS policies, grants, tables, or application code are altered.
*/

UPDATE auth.users
SET
  raw_app_meta_data = '{"provider":"email","providers":["email"]}',
  raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{sub}',
    to_jsonb(id::text)
  ) || jsonb_build_object(
    'email', email,
    'email_verified', true,
    'phone_verified', false
  )
WHERE id = 'df3aa482-2bcf-4849-a59e-ff414784c49d'
  AND email = 'admin@rupeeflow.app';
