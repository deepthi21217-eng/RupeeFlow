import { supabase } from '@/lib/supabase';

export interface AppNotification {
  id: string;
  loan_id: string | null;
  repayment_id: string | null;
  reminder_days: number;
  title: string;
  message: string;
  kind: string;
  is_read: boolean;
  created_at: string;
}

export async function loadNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('in_app_notifications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('in_app_notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.from('in_app_notifications').update({ is_read: true }).eq('is_read', false);
  if (error) throw error;
}

export async function generateLoanReminders(
  loans: { id: string; name: string; lender: string; emi: number; dueDate: string; status: string; reminderDays: number[] }[],
  repayments: { id: string; loanId: string; date: string; status: string; instalmentNumber: number }[],
): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const newNotifications: { loan_id: string; repayment_id: string; reminder_days: number; title: string; message: string; kind: string }[] = [];
  for (const loan of loans) {
    if (loan.status === 'Closed') continue;
    const schedule = repayments.filter((r) => r.loanId === loan.id);
    for (const record of schedule) {
      if (record.status === 'Paid') continue;
      const dueDate = new Date(record.date);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
      let title = '';
      let message = '';
      if (diffDays === 7) {
        title = 'Upcoming EMI reminder';
        message = `${loan.name} EMI of ₹${loan.emi} is due in 7 days on ${record.date}.`;
      } else if (diffDays === 3) {
        title = 'EMI due soon';
        message = `${loan.name} EMI of ₹${loan.emi} is due in 3 days on ${record.date}.`;
      } else if (diffDays === 1) {
        title = 'EMI due tomorrow';
        message = `${loan.name} EMI of ₹${loan.emi} is due tomorrow on ${record.date}.`;
      } else if (diffDays === 0) {
        title = 'EMI payment due today';
        message = `${loan.name} EMI of ₹${loan.emi} is due today (${record.date}).`;
      } else if (diffDays < 0 && diffDays >= -30) {
        title = 'EMI overdue alert';
        message = `${loan.name} EMI of ₹${loan.emi} was due on ${record.date} and is overdue.`;
      } else {
        continue;
      }
      const reminderDays = diffDays >= 0 ? diffDays : -1;
      if (!loan.reminderDays.includes(reminderDays) && reminderDays !== -1) continue;
      newNotifications.push({
        loan_id: loan.id,
        repayment_id: record.id,
        reminder_days: reminderDays,
        title,
        message,
        kind: 'loan_reminder',
      });
    }
  }
  let inserted = 0;
  for (const n of newNotifications) {
    const { error } = await supabase.from('in_app_notifications').insert({ ...n, is_read: false });
    if (!error) inserted++;
  }
  return inserted;
}
