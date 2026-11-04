/*
# Fix initial administrator password hashing lookup

1. Modified Function
- `setup_initial_admin(text, text, text)` keeps the existing implementation, validation, one-time guard, and server-side password hashing.
- Its function search path now includes the installed `extensions` schema, where PostgreSQL's `pgcrypto` functions `crypt` and `gen_salt` are located.

2. Security
- The function remains `SECURITY DEFINER` and executable only by the database owner/service role.
- No grants, RLS policies, tables, records, passwords, or authentication behavior are changed.

3. Important Notes
- This corrects only the function's name resolution so the existing first-admin setup can complete.
- No administrator account was created by the failed attempt because PostgreSQL rolled back that statement.
*/

ALTER FUNCTION public.setup_initial_admin(text, text, text)
  SET search_path = public, auth, extensions;
