import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, ArrowLeft, BarChart3, Clock3, FileText, Search, ShieldCheck, UserCheck, UserX, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AdminActivity, AdminSummary, AdminUser } from '@/types/auth';

interface AdminPageProps {
  onExit: () => void;
}

export default function AdminPage({ onExit }: AdminPageProps) {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activity, setActivity] = useState<AdminActivity[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAdminData();
  }, []);

  async function loadAdminData() {
    const [summaryResult, usersResult, activityResult] = await Promise.all([
      supabase.rpc('admin_platform_metrics'),
      supabase.rpc('admin_list_users'),
      supabase.rpc('admin_activity_log'),
    ]);

    if (summaryResult.error || usersResult.error || activityResult.error) {
      setError('Administrator data could not be loaded.');
      return;
    }

    setSummary(summaryResult.data?.[0] ?? null);
    setUsers(usersResult.data ?? []);
    setActivity(activityResult.data ?? []);
  }

  async function toggleUser(user: AdminUser) {
    const { error: updateError } = await supabase.rpc('admin_set_user_active', {
      p_user_id: user.id,
      p_is_active: !user.is_active,
    });

    if (updateError) {
      setError('Account status could not be changed.');
      return;
    }

    setUsers((current) => current.map((item) => (
      item.id === user.id ? { ...item, is_active: !item.is_active } : item
    )));
  }

  const filteredUsers = useMemo(
    () => users.filter((user) => `${user.full_name} ${user.email}`.toLowerCase().includes(query.toLowerCase())),
    [users, query],
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">RupeeFlow Administration</h1>
              <p className="text-sm text-slate-500">Platform health and account administration</p>
            </div>
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); onExit(); }} className="rf-btn-secondary">
            <ArrowLeft className="w-4 h-4" /> Exit
          </button>
        </div>

        {error && <div className="rf-card border-red-200 bg-red-50 text-red-700 px-4 py-3 mb-6 text-sm">{error}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <AdminStat icon={<Users />} label="Registered users" value={summary?.registered_users ?? 0} />
          <AdminStat icon={<UserCheck />} label="Active users" value={summary?.active_users ?? 0} />
          <AdminStat icon={<UserX />} label="Inactive users" value={summary?.inactive_users ?? 0} />
          <AdminStat icon={<FileText />} label="Statements uploaded" value={summary?.uploaded_statements ?? 0} />
          <AdminStat icon={<BarChart3 />} label="Transactions processed" value={summary?.processed_transactions ?? 0} />
          <AdminStat icon={<Activity />} label="Platform events" value={summary?.platform_events ?? 0} />
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem] gap-6">
          <div className="rf-card overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-800">User management</h2>
                <p className="text-xs text-slate-400 mt-1">Only account metadata is shown. Private financial records remain inaccessible.</p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input className="rf-input pl-9 w-64" placeholder="Search users" value={query} onChange={(event) => setQuery(event.target.value)} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="text-left px-5 py-3">User</th><th className="text-left px-5 py-3">Registered</th><th className="text-left px-5 py-3">Status</th><th className="text-right px-5 py-3">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-5 py-3"><p className="font-medium text-slate-700">{user.full_name || 'Unnamed user'}</p><p className="text-xs text-slate-400">{user.email}</p></td>
                      <td className="px-5 py-3 text-slate-500">{new Date(user.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="px-5 py-3"><span className={`rf-badge ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{user.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td className="px-5 py-3 text-right"><button onClick={() => void toggleUser(user)} className="rf-btn-ghost text-xs">{user.is_active ? 'Deactivate' : 'Activate'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && <p className="text-center text-sm text-slate-400 py-10">No users found.</p>}
            </div>
          </div>

          <div className="rf-card p-5">
            <div className="flex items-center gap-2 mb-4"><Clock3 className="w-4 h-4 text-blue-600" /><h2 className="font-semibold text-slate-800">Activity log</h2></div>
            {activity.length === 0 ? <p className="text-sm text-slate-400">No platform activity recorded yet.</p> : <div className="space-y-3">{activity.map((event, index) => <div key={`${event.created_at}-${index}`} className="border-b border-slate-100 pb-3 last:border-0"><p className="text-sm text-slate-700">{formatEventType(event.event_type)}</p><p className="text-xs text-slate-400 mt-1">{new Date(event.created_at).toLocaleString('en-IN')}</p></div>)}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatEventType(eventType: string): string {
  return eventType.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function AdminStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className="rf-card p-4"><div className="text-blue-600 mb-3">{icon}</div><p className="text-2xl font-bold text-slate-800">{value}</p><p className="text-xs text-slate-500 mt-1">{label}</p></div>;
}
