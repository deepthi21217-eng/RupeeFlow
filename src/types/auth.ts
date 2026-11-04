export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  is_active: boolean;
}

export interface AdminSummary {
  registered_users: number;
  active_users: number;
  inactive_users: number;
  uploaded_statements: number;
  processed_transactions: number;
  platform_events: number;
}

export interface AdminActivity {
  event_type: string;
  created_at: string;
}
