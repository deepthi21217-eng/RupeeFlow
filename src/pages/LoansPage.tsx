import { useState, useEffect, useMemo } from 'react';
import { Loan, RepaymentRecord } from '@/types/stage2';
import { REMINDER_DAYS_OPTIONS } from '@/types/stage2';
import { loadLoans, saveLoans, loadRepayments, saveRepayments } from '@/utils/storage2';
import { formatINR, formatDate } from '@/utils/format';
import PageHeader from '@/components/PageHeader';
import {
  Landmark, Plus, Edit3, Trash2, Check, X, Bell,
  Clock, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Archive, Calculator, CalendarDays, TrendingDown,
} from 'lucide-react';
import { loadCloudLoans, loadCloudRepayments, ensureCloudRepayments, saveCloudLoan, deleteCloudLoan, saveCloudRepayment } from '@/utils/cloudLoans';
import { calculateEmi, computePortfolioStats, assessLoanHealth } from '@/utils/loanCalc';
import { exportLoanSummary, exportRepaymentHistory } from '@/utils/loanExport';

const FREQUENCIES: Loan['frequency'][] = ['Monthly', 'Quarterly', 'Weekly', 'Bi-weekly'];

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

type DisplayStatus = 'Paid' | 'Upcoming' | 'Due' | 'Overdue';

function getDisplayStatus(r: RepaymentRecord): DisplayStatus {
  if (r.status === 'Paid') return 'Paid';
  const today = todayStr();
  if (r.date < today) return 'Overdue';
  if (r.date === today) return 'Due';
  return 'Upcoming';
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<RepaymentRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [payModal, setPayModal] = useState<{ loanId: string; record: RepaymentRecord } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(todayStr());
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calculator, setCalculator] = useState({ principal: '', rate: '', tenure: '', unit: 'months' as 'months' | 'years' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [loaded, loadedRepayments] = await Promise.all([loadCloudLoans(), loadCloudRepayments()]);
        const completeRepayments = await ensureCloudRepayments(loaded, loadedRepayments);
        if (!cancelled) { setLoans(loaded.map((l) => ({ ...l, status: l.status ?? 'Active' }))); setRepayments(completeRepayments); }
      } catch {
        if (!cancelled) { setLoans(loadLoans().map((l) => ({ ...l, status: l.status ?? 'Active' }))); setRepayments(loadRepayments()); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [form, setForm] = useState<Partial<Loan>>({
    name: '', lender: '', amount: 0, category: 'Personal', interestRate: 0, emi: 0, startDate: '', dueDate: '',
    frequency: 'Monthly', tenureMonths: null, mobileNumber: '', reminderDays: [3, 1], notes: '',
    status: 'Active', email: '', emailReminders: false, smsReminders: false,
  });

  function persistLoans(updated: Loan[]) {
    setLoans(updated); saveLoans(updated);
    void Promise.all(updated.map((loan) => saveCloudLoan(loan))).catch(() => undefined);
  }
  function persistRepayments(updated: RepaymentRecord[]) {
    setRepayments(updated); saveRepayments(updated);
    const latest = updated[updated.length - 1];
    if (latest) void saveCloudRepayment(latest).catch(() => undefined);
  }

  const [formError, setFormError] = useState<string | null>(null);

  function handleSave() {
    if (!form.name || !form.lender || !form.emi || !form.dueDate) return;
    if (form.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email)) {
        setFormError('Please enter a valid email address.');
        return;
      }
    }

    setFormError(null);
    const now = new Date().toISOString();
    if (editingId) {
      persistLoans(loans.map((l) => l.id === editingId ? { ...l, ...form } as Loan : l));
    } else {
      const newLoan: Loan = {
        id: crypto.randomUUID(),
        name: form.name!,
        lender: form.lender!,
        amount: form.amount ?? 0,
        category: form.category ?? 'Personal',
        interestRate: form.interestRate ?? 0,
        emi: form.emi ?? 0,
        startDate: form.startDate ?? new Date().toISOString().split('T')[0],
        dueDate: form.dueDate!,
        frequency: form.frequency ?? 'Monthly',
        tenureMonths: form.tenureMonths ?? null,
        mobileNumber: form.mobileNumber ?? '',
        reminderDays: form.reminderDays ?? [],
        notes: form.notes ?? '',
        createdAt: now,
        status: 'Active',
        email: form.email ?? '',
        emailReminders: form.emailReminders ?? false,
        smsReminders: form.smsReminders ?? false,
      };
      persistLoans([...loans, newLoan]);
    }
    resetForm();
  }

  function resetForm() {
    setForm({ name: '', lender: '', amount: 0, category: 'Personal', interestRate: 0, emi: 0, startDate: '', dueDate: '', frequency: 'Monthly', tenureMonths: null, mobileNumber: '', reminderDays: [3, 1], notes: '', status: 'Active', email: '', emailReminders: false, smsReminders: false });
    setEditingId(null);
    setShowForm(false);
    setFormError(null);
  }

  function handleEdit(loan: Loan) {
    setForm({ ...loan, status: loan.status ?? 'Active' });
    setEditingId(loan.id);
    setShowForm(true);
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this loan and all its repayment records?')) return;
    persistLoans(loans.filter((l) => l.id !== id));
    persistRepayments(repayments.filter((r) => r.loanId !== id));
    void deleteCloudLoan(id).catch(() => undefined);
  }

  function handleClose(id: string) {
    persistLoans(loans.map((l) => l.id === id ? { ...l, status: 'Closed' } : l));
  }

  function handleReopen(id: string) {
    persistLoans(loans.map((l) => l.id === id ? { ...l, status: 'Active' } : l));
  }

  function toggleReminderDay(day: number) {
    const current = form.reminderDays ?? [];
    setForm({ ...form, reminderDays: current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => b - a) });
  }

  function getSchedule(loan: Loan): RepaymentRecord[] {
    const existing = repayments.filter((r) => r.loanId === loan.id);
    const records: RepaymentRecord[] = [...existing];
    const dueDate = new Date(loan.dueDate);
    const today = todayStr();
    const existingKeys = new Set(existing.map((r) => r.date));

    const totalInstalments = loan.tenureMonths ?? 12;
    for (let i = 0; i < totalInstalments; i++) {
      const d = addMonths(dueDate, i);
      const dateStr = d.toISOString().split('T')[0];
      if (existingKeys.has(dateStr)) continue;

      const isOverdue = dateStr < today;
      records.push({
        id: crypto.randomUUID(),
        loanId: loan.id,
        date: dateStr,
        amount: loan.emi,
        instalmentNumber: i + 1,
        actualAmount: null,
        paymentDate: null,
        status: isOverdue ? 'Overdue' : 'Scheduled',
        reminderStatus: 'Not Configured',
        notes: '',
      });
      if (i >= 59) break;
    }
    return records
      .filter((r) => r.loanId === loan.id)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r, idx) => ({ ...r, instalmentNumber: idx + 1 }));
  }

  function openPayModal(loanId: string, record: RepaymentRecord) {
    setPayAmount(String(record.amount));
    setPayDate(todayStr());
    setPayModal({ loanId, record });
  }

  function confirmPay() {
    if (!payModal) return;
    const { loanId, record } = payModal;
    const amount = parseFloat(payAmount) || record.amount;
    const date = payDate || todayStr();

    const existing = repayments.find((r) => r.id === record.id);
    if (existing) {
      const updated = repayments.map((r) => r.id === record.id ? { ...r, status: 'Paid' as const, actualAmount: amount, paymentDate: date } : r);
      persistRepayments(updated);
      void saveCloudRepayment(updated.find((r) => r.id === record.id)!).catch(() => undefined);
    } else {
      const paidRecord = { ...record, id: crypto.randomUUID(), loanId, status: 'Paid' as const, actualAmount: amount, paymentDate: date };
      persistRepayments([...repayments, paidRecord]);
      void saveCloudRepayment(paidRecord).catch(() => undefined);
    }

    const loan = loans.find((l) => l.id === loanId);
    setShowSuccess(`${loan?.name ?? 'Loan'} — Instalment #${record.instalmentNumber} marked as paid`);
    setPayModal(null);
    setTimeout(() => setShowSuccess(null), 3000);
  }

  function handleMarkUnpaid(recordId: string) {
    const updated = repayments.map((r) => r.id === recordId ? { ...r, status: 'Scheduled' as const, actualAmount: null, paymentDate: null } : r);
    persistRepayments(updated);
    const record = updated.find((r) => r.id === recordId);
    if (record) void saveCloudRepayment(record).catch(() => undefined);
  }

  const allSchedules = useMemo(() => {
    const map: Record<string, RepaymentRecord[]> = {};
    for (const loan of loans) {
      map[loan.id] = getSchedule(loan);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loans, repayments]);

  const upcomingPayments = useMemo(() => {
    const today = todayStr();
    return Object.values(allSchedules).flat().filter((r) => r.status !== 'Paid' && r.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [allSchedules]);

  const overduePayments = useMemo(() => {
    return Object.values(allSchedules).flat().filter((r) => getDisplayStatus(r) === 'Overdue').sort((a, b) => a.date.localeCompare(b.date));
  }, [allSchedules]);

  const portfolioStats = useMemo(() => computePortfolioStats(loans, allSchedules), [loans, allSchedules]);
  const income = loans.find((loan) => loan.monthlyIncome && loan.monthlyIncome > 0)?.monthlyIncome ?? null;
  const health = useMemo(() => assessLoanHealth(loans, income), [loans, income]);
  const calculatorResult = useMemo(() => {
    const principal = Number(calculator.principal);
    const rate = Number(calculator.rate);
    const tenureInput = Number(calculator.tenure);
    if (!principal || !tenureInput || principal <= 0 || tenureInput <= 0) return null;
    return calculateEmi(principal, rate || 0, calculator.unit === 'years' ? tenureInput * 12 : tenureInput);
  }, [calculator]);
  const calendarRows = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    return Object.values(allSchedules).flat().filter((record) => {
      const date = new Date(record.date);
      return date.getFullYear() === year && date.getMonth() === month;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [allSchedules, calendarMonth]);

  return (
    <div>
      <PageHeader
        title="Loans & Payments"
        subtitle="Track loans, EMIs, recurring payments, and due-date reminders"
        icon={<Landmark className="w-5 h-5" />}
        actions={
          <button onClick={() => { resetForm(); setShowForm(true); }} className="rf-btn-primary">
            <Plus className="w-4 h-4" /> Add Loan
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <SummaryCard label="Total Loans" value={String(portfolioStats.totalLoans)} />
        <SummaryCard label="Principal" value={formatINR(portfolioStats.totalPrincipal)} />
        <SummaryCard label="Outstanding" value={formatINR(portfolioStats.totalOutstanding)} />
        <SummaryCard label="Monthly EMI" value={formatINR(portfolioStats.totalMonthlyEmi)} />
        <SummaryCard label="Interest Payable" value={formatINR(portfolioStats.totalInterestPayable)} />
        <SummaryCard label="Total Repaid" value={formatINR(portfolioStats.totalRepaid)} />
        <SummaryCard label="Completion" value={`${portfolioStats.completionPercent}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rf-card p-5">
          <div className="flex items-center gap-2 mb-4"><Calculator className="w-5 h-5 text-blue-600" /><h3 className="text-sm font-semibold text-slate-800">EMI Calculator</h3></div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Principal (₹)"><input type="number" min="0" className="rf-input" value={calculator.principal} onChange={(e) => setCalculator({ ...calculator, principal: e.target.value })} /></FormField>
            <FormField label="Annual Interest (%)"><input type="number" min="0" step="0.01" className="rf-input" value={calculator.rate} onChange={(e) => setCalculator({ ...calculator, rate: e.target.value })} /></FormField>
            <FormField label="Tenure"><input type="number" min="1" className="rf-input" value={calculator.tenure} onChange={(e) => setCalculator({ ...calculator, tenure: e.target.value })} /></FormField>
            <FormField label="Unit"><select className="rf-select" value={calculator.unit} onChange={(e) => setCalculator({ ...calculator, unit: e.target.value as 'months' | 'years' })}><option value="months">Months</option><option value="years">Years</option></select></FormField>
          </div>
          {calculatorResult && <div className="mt-4 grid grid-cols-3 gap-3 bg-blue-50 rounded-lg p-3"><SummaryItem label="Monthly EMI" value={formatINR(calculatorResult.monthlyEmi)} /><SummaryItem label="Total Interest" value={formatINR(calculatorResult.totalInterest)} /><SummaryItem label="Total Repayment" value={formatINR(calculatorResult.totalRepayment)} /></div>}
          {calculatorResult && <div className="mt-4 max-h-48 overflow-y-auto border border-slate-100 rounded-lg"><table className="w-full text-xs"><thead className="bg-slate-50 sticky top-0"><tr><th className="text-left px-3 py-2">#</th><th className="text-right px-3 py-2">Principal</th><th className="text-right px-3 py-2">Interest</th><th className="text-right px-3 py-2">Balance</th></tr></thead><tbody className="divide-y divide-slate-100">{calculatorResult.schedule.map((row) => <tr key={row.instalment}><td className="px-3 py-2">{row.instalment}</td><td className="px-3 py-2 text-right text-green-600">{formatINR(row.principal)}</td><td className="px-3 py-2 text-right text-amber-600">{formatINR(row.interest)}</td><td className="px-3 py-2 text-right">{formatINR(row.balance)}</td></tr>)}</tbody></table></div>}
        </div>
        <div className="rf-card p-5">
          <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-blue-600" /><h3 className="text-sm font-semibold text-slate-800">Repayment Calendar</h3></div><div className="flex items-center gap-2"><button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="rf-btn-ghost px-2">‹</button><span className="text-xs font-medium text-slate-600 min-w-[90px] text-center">{calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span><button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="rf-btn-ghost px-2">›</button></div></div>
          <div className="space-y-2 max-h-56 overflow-y-auto">{calendarRows.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No EMIs scheduled this month.</p> : calendarRows.map((record) => { const loan = loans.find((item) => item.id === record.loanId); const status = getDisplayStatus(record); return <div key={record.id} className="flex items-center justify-between border-b border-slate-50 pb-2"><div><p className="text-xs font-medium text-slate-700">{loan?.name ?? 'Loan'}</p><p className="text-[11px] text-slate-400">{formatDate(record.date)} · EMI #{record.instalmentNumber}</p></div><div className="text-right"><p className="text-xs font-medium text-slate-700">{formatINR(record.amount)}</p><span className={`rf-badge text-[10px] ${status === 'Paid' ? 'bg-green-100 text-green-700' : status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{status}</span></div></div>; })}</div>
          <div className="border-t border-slate-100 mt-3 pt-3 flex justify-between text-xs"><span className="text-slate-500">Monthly EMI payable</span><strong className="text-slate-700">{formatINR(calendarRows.reduce((sum, record) => sum + record.amount, 0))}</strong></div>
        </div>
      </div>

      <div className="rf-card p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3"><TrendingDown className={`w-5 h-5 mt-0.5 ${health.rating === 'Healthy' ? 'text-green-600' : health.rating === 'Moderate' ? 'text-amber-600' : 'text-red-600'}`} /><div><p className="text-sm font-semibold text-slate-700">Repayment health: {health.rating}</p><p className="text-xs text-slate-500 mt-1">{health.insight} This is an indicative planning insight, not a credit rating or lending decision.</p></div></div>
        <div className="flex gap-2"><button onClick={() => exportLoanSummary(loans, repayments)} className="rf-btn-secondary text-xs">Export loan summary</button><button onClick={() => exportRepaymentHistory(repayments, loans)} className="rf-btn-secondary text-xs">Export repayment history</button></div>
      </div>

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 rf-card border-green-200 bg-green-50 p-4 flex items-center gap-3 shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm font-medium text-green-800">{showSuccess}</p>
        </div>
      )}

      {/* Notification Settings */}
      <div className="rf-card p-4 mb-6 border-blue-100 bg-blue-50/40">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <p className="font-medium text-slate-700">In-App Payment Reminders</p>
            <p className="text-xs text-slate-500 mt-0.5">
              RupeeFlow sends payment due-date reminders through in-app notifications. Configure reminder days per loan to receive alerts
              before each EMI is due. Reminders fire at 7, 3, and 1 day(s) before the due date, and on the due date itself. Paid instalments are automatically skipped.
            </p>
          </div>
          <span className="rf-badge bg-green-100 text-green-700 text-[10px] flex items-center gap-1 flex-shrink-0">
            <CheckCircle2 className="w-3 h-3" /> Active
          </span>
        </div>
      </div>

      {/* Overdue + Upcoming */}
      {(overduePayments.length > 0 || upcomingPayments.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {overduePayments.length > 0 && (
            <div className="rf-card p-4 border-red-200 bg-red-50/40">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <h3 className="text-sm font-semibold text-slate-700">Overdue Payments ({overduePayments.length})</h3>
              </div>
              <div className="space-y-2">
                {overduePayments.map((r) => {
                  const loan = loans.find((l) => l.id === r.loanId);
                  return (
                    <div key={r.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-slate-700">{loan?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-red-400">Due: {formatDate(r.date)}</p>
                      </div>
                      <span className="text-red-500 font-medium">{formatINR(r.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {upcomingPayments.length > 0 && (
            <div className="rf-card p-4 border-blue-200 bg-blue-50/40">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-700">Upcoming Payments ({upcomingPayments.length})</h3>
              </div>
              <div className="space-y-2">
                {upcomingPayments.map((r) => {
                  const loan = loans.find((l) => l.id === r.loanId);
                  return (
                    <div key={r.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-slate-700">{loan?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-slate-400">Due: {formatDate(r.date)}</p>
                      </div>
                      <span className="text-blue-600 font-medium">{formatINR(r.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loan Form */}
      {showForm && (
        <div className="rf-card p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">{editingId ? 'Edit Loan' : 'Add New Loan / Recurring Payment'}</h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          {formError && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {formError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Loan Name" required>
              <input type="text" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rf-input" placeholder="e.g., Education Loan" />
            </FormField>
            <FormField label="Lender / Bank" required>
              <input type="text" value={form.lender ?? ''} onChange={(e) => setForm({ ...form, lender: e.target.value })} className="rf-input" placeholder="e.g., HDFC Bank" />
            </FormField>
            <FormField label="Loan Category">
              <select value={form.category ?? 'Personal'} onChange={(e) => setForm({ ...form, category: e.target.value as Loan['category'] })} className="rf-select">
                {['Personal', 'Education', 'Home', 'Vehicle', 'Business', 'Other'].map((category) => <option key={category}>{category}</option>)}
              </select>
            </FormField>
            <FormField label="Annual Interest Rate (%)">
              <input type="number" min="0" step="0.01" value={form.interestRate ?? 0} onChange={(e) => setForm({ ...form, interestRate: parseFloat(e.target.value) || 0 })} className="rf-input" />
            </FormField>
            <FormField label="Monthly Income (₹)">
              <input type="number" min="0" value={form.monthlyIncome ?? ''} onChange={(e) => setForm({ ...form, monthlyIncome: e.target.value ? parseFloat(e.target.value) : null })} className="rf-input" placeholder="Optional" />
            </FormField>
            <FormField label="Loan Amount (₹)">
              <input type="number" value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className="rf-input" />
            </FormField>
            <FormField label="EMI Amount (₹)" required>
              <input type="number" value={form.emi ?? 0} onChange={(e) => setForm({ ...form, emi: parseFloat(e.target.value) || 0 })} className="rf-input" />
            </FormField>
            <FormField label="Start Date">
              <input type="date" value={form.startDate ?? ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="rf-input" />
            </FormField>
            <FormField label="Next Due Date" required>
              <input type="date" value={form.dueDate ?? ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="rf-input" />
            </FormField>
            <FormField label="Frequency">
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as Loan['frequency'] })} className="rf-select">
                {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </FormField>
            <FormField label="Tenure (months)">
              <input type="number" value={form.tenureMonths ?? ''} onChange={(e) => setForm({ ...form, tenureMonths: e.target.value ? parseInt(e.target.value) : null })} className="rf-input" placeholder="e.g., 60" />
            </FormField>
            <FormField label="Mobile Number (with country code)">
              <input type="tel" value={form.mobileNumber ?? ''} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} className="rf-input" placeholder="e.g., +91 9876543210" />
            </FormField>
            <FormField label="Email for Loan Reminders">
              <input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rf-input" placeholder="e.g., user@example.com" />
            </FormField>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-2 block">Reminder Days (days before due date)</label>
            <div className="flex flex-wrap gap-2">
              {REMINDER_DAYS_OPTIONS.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleReminderDay(day)}
                  className={`rf-badge cursor-pointer text-xs px-3 py-1.5 ${form.reminderDays?.includes(day) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                >
                  {day === 0 ? 'On due date' : `${day} day${day > 1 ? 's' : ''} before`}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-blue-50/60 rounded-lg p-3 flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-xs text-slate-600">
              In-app payment reminders are sent based on the reminder days selected above. You will see notifications in the bell icon at the top of the app.
            </p>
          </div>
          <FormField label="Notes">
            <textarea value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rf-input" rows={2} placeholder="Optional notes about this loan" />
          </FormField>
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="rf-btn-secondary">Cancel</button>
            <button onClick={handleSave} className="rf-btn-primary">
              <Check className="w-4 h-4" /> {editingId ? 'Update' : 'Save'} Loan
            </button>
          </div>
        </div>
      )}

      {/* Loan Cards */}
      {loans.length === 0 && !showForm ? (
        <div className="rf-card p-12 text-center">
          <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No Loans Configured</h3>
          <p className="text-sm text-slate-400">Add a loan or recurring payment to start tracking EMIs, due dates, and reminders.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {loans.map((loan) => {
            const schedule = allSchedules[loan.id] ?? [];
            const paidRecords = schedule.filter((r) => r.status === 'Paid');
            const paidCount = paidRecords.length;
            const totalCount = schedule.length;
            const remainingCount = totalCount - paidCount;
            const overdueCount = schedule.filter((r) => getDisplayStatus(r) === 'Overdue').length;
            const totalScheduledAmount = schedule.reduce((sum, r) => sum + r.amount, 0);
            const totalPaidAmount = paidRecords.reduce((sum, r) => sum + (r.actualAmount ?? r.amount), 0);
            const nextDue = schedule.find((r) => r.status !== 'Paid');
            const progressPercent = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;
            const isExpanded = expandedLoanId === loan.id;
            const loanStatus = loan.status ?? 'Active';
            const isClosed = loanStatus === 'Closed';

            return (
              <div key={loan.id} className="rf-card overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                        <Landmark className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-800">{loan.name}</h3>
                          <span className={`rf-badge text-[10px] ${isClosed ? 'bg-slate-200 text-slate-600' : 'bg-green-100 text-green-700'}`}>
                            {loanStatus}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{loan.lender} · EMI: {formatINR(loan.emi)} · {loan.frequency}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(loan)} className="rf-btn-ghost p-1.5"><Edit3 className="w-4 h-4" /></button>
                      {isClosed ? (
                        <button onClick={() => handleReopen(loan.id)} className="rf-btn-ghost p-1.5 text-green-600" title="Reopen Loan"><Archive className="w-4 h-4" /></button>
                      ) : (
                        <button onClick={() => handleClose(loan.id)} className="rf-btn-ghost p-1.5 text-slate-400" title="Mark as Closed"><Archive className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => handleDelete(loan.id)} className="rf-btn-ghost p-1.5 text-red-500"><Trash2 className="w-4 h-4" /></button>
                      <button onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)} className="rf-btn-ghost p-1.5 text-xs flex items-center gap-1">
                        {isExpanded ? <><ChevronUp className="w-4 h-4" /> Hide</> : <><ChevronDown className="w-4 h-4" /> Schedule</>}
                      </button>
                    </div>
                  </div>

                  {/* Loan Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-4 text-sm">
                    <SummaryItem label="Loan Amount" value={loan.amount > 0 ? formatINR(loan.amount) : '—'} />
                    <SummaryItem label="Monthly EMI" value={formatINR(loan.emi)} />
                    <SummaryItem label="Start Date" value={loan.startDate ? formatDate(loan.startDate) : '—'} />
                    <SummaryItem label="Tenure" value={loan.tenureMonths ? `${loan.tenureMonths} mo` : '—'} />
                    <SummaryItem label="Status" value={loanStatus} />
                    <SummaryItem label="Total Instalments" value={String(totalCount)} />
                    <SummaryItem label="Paid Instalments" value={`${paidCount} of ${totalCount}`} />
                    <SummaryItem label="Remaining" value={String(remainingCount)} />
                    <SummaryItem label="Overdue" value={String(overdueCount)} highlight={overdueCount > 0 ? 'red' : undefined} />
                    <SummaryItem label="Total Scheduled" value={formatINR(totalScheduledAmount)} />
                    <SummaryItem label="Total Paid" value={formatINR(totalPaidAmount)} />
                    <SummaryItem label="Next Due Date" value={nextDue ? formatDate(nextDue.date) : 'All paid'} />
                    <SummaryItem label="Progress" value={`${progressPercent}%`} />
                    <SummaryItem label="Reminders" value={
                      <span className="flex items-center gap-1">
                        <Bell className="w-3.5 h-3.5 text-amber-500" />
                        {loan.reminderDays.length > 0 ? loan.reminderDays.map((d) => d === 0 ? 'due' : `${d}d`).join(', ') : 'Off'}
                      </span>
                    } />
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Payment Progress</span>
                      <span>{paidCount} / {totalCount} instalments · {progressPercent}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>


                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Monthly Payment Schedule</h4>
                    <div className="max-h-[450px] overflow-y-auto bg-white rounded-lg border border-slate-100">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                          <tr className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">
                            <th className="px-4 py-2.5">Instalment</th>
                            <th className="px-4 py-2.5">Due Date</th>
                            <th className="px-4 py-2.5 text-right">EMI Amount</th>
                            <th className="px-4 py-2.5">Status</th>
                            <th className="px-4 py-2.5">Payment Date</th>
                            <th className="px-4 py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {schedule.map((r) => {
                            const ds = getDisplayStatus(r);
                            return (
                              <tr key={r.id} className="hover:bg-blue-50/30">
                                <td className="px-4 py-2.5 text-slate-600 font-medium">
                                  #{r.instalmentNumber}
                                  <span className="text-xs text-slate-400 ml-1.5">{monthLabel(r.date)}</span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(r.date)}</td>
                                <td className="px-4 py-2.5 text-right font-medium text-slate-700 whitespace-nowrap">
                                  {formatINR(r.amount)}
                                  {r.status === 'Paid' && r.actualAmount !== null && r.actualAmount !== r.amount && (
                                    <div className="text-xs text-green-600">{formatINR(r.actualAmount)} paid</div>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={`rf-badge text-[10px] ${
                                    ds === 'Paid' ? 'bg-green-100 text-green-700'
                                    : ds === 'Overdue' ? 'bg-red-100 text-red-600'
                                    : ds === 'Due' ? 'bg-amber-100 text-amber-700'
                                    : 'bg-blue-100 text-blue-600'
                                  }`}>
                                    {ds}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap text-xs">
                                  {r.paymentDate ? formatDate(r.paymentDate) : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  {r.status === 'Paid' ? (
                                    <button onClick={() => handleMarkUnpaid(r.id)} className="rf-btn-ghost text-xs text-slate-500">Undo</button>
                                  ) : (
                                    <button onClick={() => openPayModal(loan.id, r)} className="rf-btn-primary text-xs py-1.5">
                                      <Check className="w-3.5 h-3.5" /> Mark Paid
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {schedule.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-4">No scheduled payments. Set a due date and tenure to generate the schedule.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setPayModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Confirm Payment</h3>
                <p className="text-sm text-slate-400 mt-0.5">Mark this instalment as paid</p>
              </div>
              <button onClick={() => setPayModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {(() => {
              const loan = loans.find((l) => l.id === payModal.loanId);
              return (
                <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Loan</span>
                    <span className="font-medium text-slate-700">{loan?.name ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Instalment</span>
                    <span className="font-medium text-slate-700">#{payModal.record.instalmentNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Due Date</span>
                    <span className="font-medium text-slate-700">{formatDate(payModal.record.date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Scheduled EMI</span>
                    <span className="font-medium text-slate-700">{formatINR(payModal.record.amount)}</span>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-3">
              <FormField label="Actual Amount Paid (₹)">
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="rf-input"
                  placeholder="Enter amount paid"
                />
              </FormField>
              <FormField label="Payment Date">
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="rf-input"
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setPayModal(null)} className="rf-btn-secondary">Cancel</button>
              <button onClick={confirmPay} className="rf-btn-primary">
                <CheckCircle2 className="w-4 h-4" /> Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rf-card p-3"><p className="text-[11px] text-slate-400">{label}</p><p className="text-sm font-bold text-slate-700 mt-1 truncate">{value}</p></div>;
}

function SummaryItem({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: 'red' }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`font-medium ${highlight === 'red' ? 'text-red-600' : 'text-slate-700'}`}>{value}</p>
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block">{label} {required && <span className="text-red-500">*</span>}</label>
      {children}
    </div>
  );
}
