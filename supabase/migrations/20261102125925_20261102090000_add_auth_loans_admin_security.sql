/*
# Add authenticated RupeeFlow data model and admin controls

1. New Tables
- `profiles` stores display names, account role, activation state, and registration time. The role and activation fields are operator-controlled.
- `loans` stores each user's loan portfolio, EMI inputs, interest rate, category, and optional income used for indicative repayment health.
- `repayments` stores one scheduled or paid installment per loan and prevents duplicate installment rows.
- `in_app_notifications` stores private reminder history and read/unread state.
- `platform_events` stores aggregate platform activity events without bank statement contents.

2. Security
- Every private table has RLS enabled and is scoped to the signed-in user's id.
- Browser users can edit only their own loan inputs and repayment records; profile role and activation fields cannot be changed by users.
- Admin reporting reads only profile/account metadata and aggregate activity, never financial records.
- The public signup flow can only create normal user profiles through the auth trigger.
- Admin role changes require the service role and are not exposed as a public RPC.

3. Important Notes
- Existing local-storage data remains untouched and is not deleted by this migration.
- Existing notification log rows cannot be assigned to a user automatically, so they are not exposed through the new authenticated policies.
- `auth.users` remains the source of truth for passwords and sessions; no custom password table is created.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  lender text NOT NULL,
  category text NOT NULL DEFAULT 'Personal',
  principal numeric NOT NULL DEFAULT 0 CHECK (principal >= 0),
  interest_rate numeric NOT NULL DEFAULT 0 CHECK (interest_rate >= 0 AND interest_rate <= 100),
  emi numeric NOT NULL DEFAULT 0 CHECK (emi >= 0),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  frequency text NOT NULL DEFAULT 'Monthly',
  tenure_months integer CHECK (tenure_months IS NULL OR (tenure_months > 0 AND tenure_months <= 600)),
  mobile_number text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  reminder_days integer[] NOT NULL DEFAULT ARRAY[7,3,1,0],
  notes text NOT NULL DEFAULT '',
  monthly_income numeric CHECK (monthly_income IS NULL OR monthly_income >= 0),
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  instalment_number integer NOT NULL CHECK (instalment_number > 0),
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  actual_amount numeric CHECK (actual_amount IS NULL OR actual_amount >= 0),
  payment_date date,
  status text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Paid', 'Scheduled', 'Overdue')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loan_id, instalment_number)
);

CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id uuid REFERENCES public.loans(id) ON DELETE CASCADE,
  repayment_id uuid REFERENCES public.repayments(id) ON DELETE CASCADE,
  reminder_days integer NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  kind text NOT NULL DEFAULT 'loan_reminder',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, repayment_id, reminder_days)
);

CREATE TABLE IF NOT EXISTS public.platform_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loans_user_id_idx ON public.loans(user_id);
CREATE INDEX IF NOT EXISTS repayments_user_id_idx ON public.repayments(user_id);
CREATE INDEX IF NOT EXISTS repayments_due_date_idx ON public.repayments(user_id, due_date);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.in_app_notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_events_created_at_idx ON public.platform_events(created_at DESC);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.platform_events (user_id, event_type) VALUES (NEW.id, 'user_registered');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE (full_name, updated_at) ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repayments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.in_app_notifications TO authenticated;
GRANT INSERT ON public.platform_events TO authenticated;
GRANT SELECT ON public.platform_events TO authenticated;
GRANT ALL ON public.profiles, public.loans, public.repayments, public.in_app_notifications, public.platform_events TO service_role;

DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
CREATE POLICY "profiles_select_self" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "loans_select_own" ON public.loans;
CREATE POLICY "loans_select_own" ON public.loans FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "loans_insert_own" ON public.loans;
CREATE POLICY "loans_insert_own" ON public.loans FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "loans_update_own" ON public.loans;
CREATE POLICY "loans_update_own" ON public.loans FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "loans_delete_own" ON public.loans;
CREATE POLICY "loans_delete_own" ON public.loans FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "repayments_select_own" ON public.repayments;
CREATE POLICY "repayments_select_own" ON public.repayments FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "repayments_insert_own" ON public.repayments;
CREATE POLICY "repayments_insert_own" ON public.repayments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.loans WHERE loans.id = loan_id AND loans.user_id = auth.uid()));
DROP POLICY IF EXISTS "repayments_update_own" ON public.repayments;
CREATE POLICY "repayments_update_own" ON public.repayments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "repayments_delete_own" ON public.repayments;
CREATE POLICY "repayments_delete_own" ON public.repayments FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_select_own" ON public.in_app_notifications;
CREATE POLICY "notifications_select_own" ON public.in_app_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_insert_own" ON public.in_app_notifications;
CREATE POLICY "notifications_insert_own" ON public.in_app_notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_update_own" ON public.in_app_notifications;
CREATE POLICY "notifications_update_own" ON public.in_app_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "notifications_delete_own" ON public.in_app_notifications;
CREATE POLICY "notifications_delete_own" ON public.in_app_notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "events_insert_own" ON public.platform_events;
CREATE POLICY "events_insert_own" ON public.platform_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "events_select_own" ON public.platform_events;
CREATE POLICY "events_select_own" ON public.platform_events FOR SELECT TO authenticated USING (user_id = auth.uid());

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
