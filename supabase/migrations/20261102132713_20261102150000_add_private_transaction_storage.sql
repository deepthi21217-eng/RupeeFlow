/*
# Add private transaction and statement storage

1. New Tables
- `financial_transactions` stores imported bank transactions for the signed-in owner, including dates, descriptions, amounts, categories, account labels, balances, references, duplicate flags, transfer flags, and user category edits.
- `statement_uploads` stores upload metadata only: original filename, file type, file size, imported/skipped/duplicate counts, and completion time. It does not store the raw bank statement file.

2. Security
- Both tables use authenticated-only access with `user_id = auth.uid()` policies for all CRUD operations.
- The owner column defaults from the active session and cannot be assigned to another user.
- No anonymous role receives access.

3. Important Notes
- Existing browser data is not deleted or rewritten by this migration.
- The application will upload parsed transaction rows, not raw statement files, so private source documents are not retained by the platform.
- Account numbers and descriptions remain visible only to the owner through RLS.
*/

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_date date NOT NULL,
  description text NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
  amount numeric NOT NULL CHECK (amount >= 0),
  category text NOT NULL DEFAULT 'Uncategorized',
  account text NOT NULL DEFAULT '',
  balance_after numeric,
  reference text,
  merchant text,
  is_duplicate boolean NOT NULL DEFAULT false,
  is_internal_transfer boolean NOT NULL DEFAULT false,
  user_edited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.statement_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('csv', 'excel')),
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes >= 0),
  imported_count integer NOT NULL DEFAULT 0 CHECK (imported_count >= 0),
  skipped_count integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  duplicate_count integer NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financial_transactions_user_date_idx ON public.financial_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS statement_uploads_user_created_idx ON public.statement_uploads(user_id, created_at DESC);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_uploads ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.statement_uploads TO authenticated;
GRANT ALL ON public.financial_transactions, public.statement_uploads TO service_role;

DROP POLICY IF EXISTS "transactions_select_own" ON public.financial_transactions;
CREATE POLICY "transactions_select_own" ON public.financial_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "transactions_insert_own" ON public.financial_transactions;
CREATE POLICY "transactions_insert_own" ON public.financial_transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "transactions_update_own" ON public.financial_transactions;
CREATE POLICY "transactions_update_own" ON public.financial_transactions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "transactions_delete_own" ON public.financial_transactions;
CREATE POLICY "transactions_delete_own" ON public.financial_transactions FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "uploads_select_own" ON public.statement_uploads;
CREATE POLICY "uploads_select_own" ON public.statement_uploads FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "uploads_insert_own" ON public.statement_uploads;
CREATE POLICY "uploads_insert_own" ON public.statement_uploads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "uploads_update_own" ON public.statement_uploads;
CREATE POLICY "uploads_update_own" ON public.statement_uploads FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "uploads_delete_own" ON public.statement_uploads;
CREATE POLICY "uploads_delete_own" ON public.statement_uploads FOR DELETE TO authenticated USING (user_id = auth.uid());
