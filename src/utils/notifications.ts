import { Loan, RepaymentRecord, NotificationLog } from '@/types/stage2';
import { loadNotificationLogs } from '@/utils/storage2';
export interface SendResult {
  status: 'Sent' | 'Failed' | 'Not Configured';
  message: string;
  providerResponse?: string;
  recipient?: string;
  requiresDomainVerification?: boolean;
}

export type ChannelConfigStatus = 'Configured' | 'Not Configured' | 'Unknown';

export interface NotificationConfigStatus {
  sms: ChannelConfigStatus;
  email: ChannelConfigStatus;
  functionReachable: boolean;
  error?: string;
}

export async function checkNotificationConfig(): Promise<NotificationConfigStatus> {
  return { sms: 'Not Configured', email: 'Not Configured', functionReachable: true };
}

export async function sendTestSms(loan: Loan): Promise<SendResult> {
  if (!loan.mobileNumber) {
    return { status: 'Failed', message: 'No mobile number configured on this loan.' };
  }
  return { status: 'Not Configured', message: 'External SMS is disabled. Use the in-app notification centre for EMI reminders.' };
}

export async function sendTestEmail(loan: Loan): Promise<SendResult> {
  if (!loan.email) {
    return { status: 'Failed', message: 'No email address configured on this loan.' };
  }
  return { status: 'Not Configured', message: 'External email is disabled. Use the in-app notification centre for EMI reminders.' };
}

export function getNotificationHistory(loanId?: string): NotificationLog[] {
  const all = loadNotificationLogs();
  return loanId ? all.filter((l) => l.loanId === loanId) : all;
}

export function shouldSkipReminder(record: RepaymentRecord): boolean {
  return record.status === 'Paid';
}

export function getUpcomingReminders(loans: Loan[], repayments: RepaymentRecord[], reminderDays: number[]): { loan: Loan; record: RepaymentRecord; daysBefore: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result: { loan: Loan; record: RepaymentRecord; daysBefore: number }[] = [];

  for (const loan of loans) {
    if (loan.status === 'Closed') continue;
    const schedule = repayments.filter((r) => r.loanId === loan.id);
    for (const record of schedule) {
      if (shouldSkipReminder(record)) continue;
      const dueDate = new Date(record.date);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (reminderDays.includes(diffDays)) {
        result.push({ loan, record, daysBefore: diffDays });
      }
    }
  }
  return result;
}
