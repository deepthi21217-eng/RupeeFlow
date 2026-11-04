import { Loan, RepaymentRecord } from '@/types/stage2';
import { supabase } from '@/lib/supabase';

interface LoanRow {
  id: string; name: string; lender: string; category: string; principal: number; interest_rate: number; emi: number;
  start_date: string; due_date: string; frequency: Loan['frequency']; tenure_months: number | null;
  mobile_number: string; email: string; reminder_days: number[]; notes: string; monthly_income: number | null; status: Loan['status']; created_at: string;
}
interface RepaymentRow { id: string; loan_id: string; due_date: string; amount: number; instalment_number: number; actual_amount: number | null; payment_date: string | null; status: 'Paid' | 'Scheduled' | 'Overdue'; notes: string; }

function mapLoan(row: LoanRow): Loan { return { id: row.id, name: row.name, lender: row.lender, amount: Number(row.principal), category: row.category as Loan['category'], interestRate: Number(row.interest_rate), emi: Number(row.emi), startDate: row.start_date, dueDate: row.due_date, frequency: row.frequency, tenureMonths: row.tenure_months, mobileNumber: row.mobile_number, reminderDays: row.reminder_days, notes: row.notes, createdAt: row.created_at, status: row.status, email: row.email, emailReminders: false, smsReminders: false, monthlyIncome: row.monthly_income }; }
function mapRepayment(row: RepaymentRow): RepaymentRecord { return { id: row.id, loanId: row.loan_id, date: row.due_date, amount: Number(row.amount), instalmentNumber: row.instalment_number, actualAmount: row.actual_amount === null ? null : Number(row.actual_amount), paymentDate: row.payment_date, status: row.status, reminderStatus: 'Scheduled', notes: row.notes }; }
function addMonths(date: string, months: number): string { const next = new Date(date); next.setMonth(next.getMonth() + months); return next.toISOString().split('T')[0]; }
function today(): string { return new Date().toISOString().split('T')[0]; }

export async function loadCloudLoans(): Promise<Loan[]> {
  const { data, error } = await supabase.from('loans').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data as LoanRow[]).map(mapLoan);
}
export async function loadCloudRepayments(): Promise<RepaymentRecord[]> {
  const { data, error } = await supabase.from('repayments').select('*').order('due_date', { ascending: true });
  if (error) throw error;
  return (data as RepaymentRow[]).map(mapRepayment);
}
export async function ensureCloudRepayments(loans: Loan[], existing: RepaymentRecord[]): Promise<RepaymentRecord[]> {
  const records = [...existing];
  const rows: Record<string, unknown>[] = [];
  for (const loan of loans) {
    const count = loan.tenureMonths ?? 12;
    const existingNumbers = new Set(records.filter((record) => record.loanId === loan.id).map((record) => record.instalmentNumber));
    for (let index = 0; index < count; index++) {
      const instalmentNumber = index + 1;
      if (existingNumbers.has(instalmentNumber)) continue;
      const dueDate = addMonths(loan.dueDate, index);
      const record: RepaymentRecord = { id: crypto.randomUUID(), loanId: loan.id, date: dueDate, amount: loan.emi, instalmentNumber, actualAmount: null, paymentDate: null, status: dueDate < today() ? 'Overdue' : 'Scheduled', reminderStatus: 'Scheduled', notes: '' };
      records.push(record);
      rows.push({ id: record.id, loan_id: record.loanId, instalment_number: record.instalmentNumber, due_date: record.date, amount: record.amount, status: record.status, notes: '' });
    }
  }
  if (rows.length > 0) {
    const { error } = await supabase.from('repayments').upsert(rows, { onConflict: 'loan_id,instalment_number' });
    if (error) throw error;
  }
  return records;
}
export async function saveCloudLoan(loan: Loan): Promise<void> {
  const { error } = await supabase.from('loans').upsert({ id: loan.id, name: loan.name, lender: loan.lender, principal: loan.amount, category: loan.category ?? 'Personal', interest_rate: loan.interestRate ?? 0, emi: loan.emi, start_date: loan.startDate, due_date: loan.dueDate, frequency: loan.frequency, tenure_months: loan.tenureMonths, mobile_number: loan.mobileNumber, email: loan.email ?? '', reminder_days: loan.reminderDays, notes: loan.notes, monthly_income: loan.monthlyIncome ?? null, status: loan.status, updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function deleteCloudLoan(id: string): Promise<void> { const { error } = await supabase.from('loans').delete().eq('id', id); if (error) throw error; }
export async function saveCloudRepayment(record: RepaymentRecord): Promise<void> { const { error } = await supabase.from('repayments').upsert({ id: record.id, loan_id: record.loanId, instalment_number: record.instalmentNumber, due_date: record.date, amount: record.amount, actual_amount: record.actualAmount, payment_date: record.paymentDate, status: record.status === 'Not Configured' ? 'Scheduled' : record.status, notes: record.notes, updated_at: new Date().toISOString() }); if (error) throw error; }
export async function deleteCloudRepayment(id: string): Promise<void> { const { error } = await supabase.from('repayments').delete().eq('id', id); if (error) throw error; }
