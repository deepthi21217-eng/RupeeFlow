import { Loan, RepaymentRecord, TransferMatch, NotificationLog } from '@/types/stage2';

const LOANS_KEY = 'rupeeflow_loans';
const REPAYMENTS_KEY = 'rupeeflow_repayments';
const TRANSFERS_KEY = 'rupeeflow_transfer_matches';
const NOTIF_LOG_KEY = 'rupeeflow_notification_log';
let storageScope = 'guest';
export function setStage2StorageScope(scope: string): void { storageScope = scope || 'guest'; }
function scopedKey(key: string): string { return `${key}:${storageScope}`; }

export function loadLoans(): Loan[] {
  try {
    const raw = localStorage.getItem(scopedKey(LOANS_KEY));
    return raw ? JSON.parse(raw) as Loan[] : [];
  } catch { return []; }
}

export function saveLoans(loans: Loan[]): void {
  try { localStorage.setItem(scopedKey(LOANS_KEY), JSON.stringify(loans)); } catch { /* ignore */ }
}

export function loadRepayments(): RepaymentRecord[] {
  try {
    const raw = localStorage.getItem(scopedKey(REPAYMENTS_KEY));
    return raw ? JSON.parse(raw) as RepaymentRecord[] : [];
  } catch { return []; }
}

export function saveRepayments(records: RepaymentRecord[]): void {
  try { localStorage.setItem(scopedKey(REPAYMENTS_KEY), JSON.stringify(records)); } catch { /* ignore */ }
}

export function loadTransferMatches(): TransferMatch[] {
  try {
    const raw = localStorage.getItem(scopedKey(TRANSFERS_KEY));
    return raw ? JSON.parse(raw) as TransferMatch[] : [];
  } catch { return []; }
}

export function saveTransferMatches(matches: TransferMatch[]): void {
  try { localStorage.setItem(scopedKey(TRANSFERS_KEY), JSON.stringify(matches)); } catch { /* ignore */ }
}

export function clearStage2Data(): void {
  localStorage.removeItem(scopedKey(LOANS_KEY));
  localStorage.removeItem(scopedKey(REPAYMENTS_KEY));
  localStorage.removeItem(scopedKey(TRANSFERS_KEY));
  localStorage.removeItem(scopedKey(NOTIF_LOG_KEY));
}

export function loadNotificationLogs(): NotificationLog[] {
  try {
    const raw = localStorage.getItem(scopedKey(NOTIF_LOG_KEY));
    return raw ? JSON.parse(raw) as NotificationLog[] : [];
  } catch { return []; }
}

export function saveNotificationLogs(logs: NotificationLog[]): void {
  try { localStorage.setItem(scopedKey(NOTIF_LOG_KEY), JSON.stringify(logs)); } catch { /* ignore */ }
}

export function addNotificationLog(log: NotificationLog): void {
  const existing = loadNotificationLogs();
  const dedupeKey = `${log.loanId}:${log.instalmentNumber}:${log.channel}:${log.reminderDays}:${log.scheduledFor}`;
  const filtered = existing.filter((l) => {
    const key = `${l.loanId}:${l.instalmentNumber}:${l.channel}:${l.reminderDays}:${l.scheduledFor}`;
    return key !== dedupeKey;
  });
  saveNotificationLogs([...filtered, log]);
}
