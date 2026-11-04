# Project memory

## Product intent & audience

- RupeeFlow is a production-oriented Unified Banking Intelligence Platform for authenticated borrowers/users and administrators.
- Users manage loans, calculate EMIs, review amortization schedules, track repayments, view portfolio reports, and analyze uploaded statements/transactions.
- Administrators have a separate protected experience for account management, platform aggregates, and operational monitoring.
- Users must only access their own financial data and user-facing modules.

## Brand personality & voice

- No distinct formal brand system has been established.
- The product should feel trustworthy, clear, secure, and operationally focused.
- Financial and account-state messaging should be concise, reassuring, and explicit about authentication, activation, permissions, and errors.
- Administrative language should be professional and action-oriented without exposing unnecessary personal financial details.

## Visual design & UX direction

- Preserve the existing RupeeFlow theme, navigation, module structure, and established UI patterns rather than redesigning the application.
- Keep Administrator Login distinct from the regular user entry point and route successful authentication to the protected Admin Dashboard.
- Present administrative metrics as scannable summary cards and activity sections, including users, statements, processed transactions, and platform activity.
- Make account status and activation/deactivation actions clear, with confirmation, loading, success, and error states.
- Keep administrator activity logs operational and non-sensitive; avoid exposing private transaction rows unnecessarily.
- Maintain responsive usability and accessible feedback across authentication, dashboards, tables, status indicators, and protected-route states.
- Prefer existing shared components and Lucide icons; avoid unnecessary UI or dependency changes.

## Decisions, constraints & rationale

- Stack is Vite + React with Supabase authentication, persistence, database functions, and Row Level Security.
- Existing registration/login behavior, project structure, theme, data, demo transactions, financial records, and all 11 modules must remain intact.
- The existing administrator account is `admin@rupeeflow.app`; no second administrator may be created. Credentials must not be stored in source code, frontend code, logs, or project memory.
- The first administrator was created through the existing `setup_initial_admin` function using secure database-owner/server-side execution.
- Administrator authentication requires Supabase Auth, an admin profile role, and an active account; ordinary users must not access administrator routes.
- The administrator login page uses Supabase `signInWithPassword`, matching the standard password-hash verification flow.
- The login failure was traced to incomplete Supabase Auth claims on the existing administrator record: `aud` and `role` were empty despite a valid bcrypt password hash.
- The existing administrator record was corrected server-side and its password was reset without changing its ID, profile role, active status, or email-confirmed state. Auth role is now `authenticated`.
- Password-hash verification against the newly generated password succeeded. A live browser/API sign-in could not be completed from the prior environment because server connection settings were unavailable to the local shell; do not represent end-to-end login as independently browser-verified.
- Administrator count remains exactly one. No normal users, financial records, tables, or project modules were changed; the project retains all 55 financial transactions.
- The setup function required minimal compatibility corrections: qualifying password-hashing helpers in the `extensions` schema and supplying the required authentication-user UUID.
- Profile permissions are hardened: ordinary users retain profile reads and restricted display-name updates but cannot modify role or activation state.
- Admin dashboard data uses protected aggregate/activity functions. Administrator database operations require authenticated administrative authorization.
- User-owned loan and financial-data isolation remains enforced through RLS.
- Uploaded statements and transactions are currently browser-stored and isolated per signed-in user; administrator metrics may report counts without exposing individual private records.
- Prior validation passed for linting, type checking, production build, and database security/function checks.

## Open questions & assumptions

- Confirm the hosted RupeeFlow application URL before documenting a direct login link.
- Confirm whether the admin role should be normalized/displayed as `admin` or a user-facing `ADMIN` label across types, policies, and UI.
- Confirm whether browser-stored statements/transactions should later migrate to Supabase tables and storage with corresponding RLS and aggregate access.
- Define any additional administrator roles, permissions, audit-retention requirements, or approval flows beyond the current active-admin model.
- Determine whether external email/SMS notifications and scheduled administrative reminders will be added later.
- A new administrator password was generated and communicated outside project memory; if login still fails in the deployed application, inspect environment/project configuration and perform another server-side verification without exposing the password.