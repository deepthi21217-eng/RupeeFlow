import { Transaction, TransactionCategory } from '@/types';
import { CATEGORY_LABELS } from '@/types';

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function transactionsToCSV(transactions: Transaction[]): string {
  const headers = ['Date', 'Description', 'Type', 'Category', 'Amount (INR)', 'Account', 'Balance After', 'Reference', 'Merchant'];
  const rows = transactions.map((t) => [
    t.date,
    t.description,
    t.type,
    CATEGORY_LABELS[t.category as TransactionCategory] ?? t.category,
    t.amount.toFixed(2),
    t.account,
    t.balanceAfter !== null ? t.balanceAfter.toFixed(2) : '',
    t.reference ?? '',
    t.merchant ?? '',
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
  return csv;
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadTransactionsCSV(transactions: Transaction[], filename: string): void {
  const csv = transactionsToCSV(transactions);
  downloadCSV(csv, filename);
}
