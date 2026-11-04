import { useMemo, useState } from 'react';
import { Transaction, TransactionCategory, CATEGORY_LABELS } from '@/types';
import PageHeader from '@/components/PageHeader';
import { FileText, Download, FileBarChart, Calendar, Store, Wallet, CheckSquare, FolderOpen, BarChart3, Printer, Landmark, FileDown } from 'lucide-react';
import { downloadTransactionsCSV, downloadCSV } from '@/utils/csv';
import { formatDate, formatINR } from '@/utils/format';
import { computeStats } from '@/utils/stats';
import { loadLoans, loadRepayments } from '@/utils/storage2';
import { downloadCategoryPDF } from '@/utils/pdf';

interface ReportsPageProps {
  transactions: Transaction[];
}

const CATEGORY_EXPORTS: { category: TransactionCategory; label: string }[] = [
  { category: 'P2P', label: 'Person-to-Person' },
  { category: 'P2M', label: 'Person-to-Merchant' },
  { category: 'M2P', label: 'Merchant-to-Person' },
  { category: 'Shopping', label: 'Shopping' },
  { category: 'Education', label: 'Education & College Fees' },
  { category: 'Food', label: 'Food & Dining' },
  { category: 'Travel', label: 'Travel & Transport' },
  { category: 'Transport', label: 'Bus, Train & Flight' },
  { category: 'Loan_EMI', label: 'Loan & EMI Payments' },
  { category: 'Salary', label: 'Salary & Income' },
  { category: 'Scholarship', label: 'Scholarships Received' },
  { category: 'Interest', label: 'Interest Received' },
  { category: 'Utilities', label: 'Utilities & Bills' },
  { category: 'Subscription', label: 'Subscriptions' },
  { category: 'Refund', label: 'Refunds' },
  { category: 'ATM_Withdrawal', label: 'ATM Withdrawals' },
  { category: 'Credit_Card_Payment', label: 'Credit Card Bill Payments' },
  { category: 'Internal_Transfer', label: 'Internal Transfers' },
  { category: 'Other', label: 'Other Payments' },
];

function inr(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default function ReportsPage({ transactions }: ReportsPageProps) {
  const [accountFilter, setAccountFilter] = useState('all');
  const [merchantFilter, setMerchantFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const accounts = useMemo(() => Array.from(new Set(transactions.map((t) => t.account))).sort(), [transactions]);
  const merchants = useMemo(() => Array.from(new Set(transactions.map((t) => t.merchant).filter(Boolean) as string[])).sort(), [transactions]);

  const filteredByAccount = useMemo(() => transactions.filter((t) => accountFilter === 'all' || t.account === accountFilter), [transactions, accountFilter]);
  const filteredByMerchant = useMemo(() => transactions.filter((t) => merchantFilter === 'all' || t.merchant === merchantFilter), [transactions, merchantFilter]);
  const filteredByDate = useMemo(() => {
    return transactions.filter((t) => {
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      return true;
    });
  }, [transactions, dateFrom, dateTo]);

  const stats = useMemo(() => computeStats(transactions), [transactions]);
  const monthlyData = useMemo(() => stats.monthlyData, [stats]);

  const categorySummary = useMemo(() => {
    return (Object.keys(CATEGORY_LABELS) as TransactionCategory[])
      .map((cat) => {
        const txns = transactions.filter((t) => t.category === cat);
        if (txns.length === 0) return null;
        const credits = txns.filter((t) => t.type === 'credit').reduce((a, b) => a + b.amount, 0);
        const debits = txns.filter((t) => t.type === 'debit').reduce((a, b) => a + b.amount, 0);
        return { cat, credits, debits, net: credits - debits, count: txns.length, txns };
      })
      .filter(Boolean) as { cat: TransactionCategory; credits: number; debits: number; net: number; count: number; txns: Transaction[] }[];
  }, [transactions]);

  const monthlyTxnCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of transactions) {
      const d = new Date(t.date);
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      map[label] = (map[label] ?? 0) + 1;
    }
    return map;
  }, [transactions]);

  const loanData = useMemo(() => {
    const loans = loadLoans();
    const repayments = loadRepayments();
    return loans.map((l) => {
      const lRepayments = repayments.filter((r) => r.loanId === l.id);
      const paidCount = lRepayments.filter((r) => r.status === 'Paid').length;
      const totalCount = lRepayments.length || (l.tenureMonths ?? 0);
      const csvRows = [['Date', 'Amount', 'Status', 'Notes'],
        ...lRepayments.map((r) => [r.date, r.amount.toFixed(2), r.status, r.notes])];
      const csv = csvRows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
      return { id: l.id, name: l.name, lender: l.lender, emi: l.emi, amount: l.amount, frequency: l.frequency, dueDate: l.dueDate, paidCount, totalCount, csv };
    });
  }, []);

  const today = new Date().toISOString().split('T')[0];

  function handlePrint() {
    window.print();
  }

  function handleDownloadPDF() {
    if (transactions.length === 0) return;
    setPdfLoading(true);
    try {
      downloadCategoryPDF({ transactions, category: 'all' });
    } finally {
      setPdfLoading(false);
    }
  }

  function handleCategoryPDF(category: TransactionCategory | 'all') {
    const txns = category === 'all' ? transactions : transactions.filter((t) => t.category === category);
    if (txns.length === 0) return;
    downloadCategoryPDF({ transactions: txns, category, dateFrom, dateTo });
  }

  function handleDateRangePDF() {
    if (filteredByDate.length === 0) return;
    downloadCategoryPDF({ transactions: filteredByDate, category: 'all', dateFrom, dateTo });
  }

  if (transactions.length === 0) {
    return (
      <div>
        <PageHeader title="Reports" subtitle="Export filtered transaction data as CSV or PDF files" icon={<FileText className="w-5 h-5" />} />
        <div className="rf-card p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No Data to Export</h3>
          <p className="text-sm text-slate-400">Load demo data or import transactions to generate reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Export filtered transaction data as CSV or PDF files"
        icon={<FileText className="w-5 h-5" />}
        actions={
          <button onClick={handleDownloadPDF} disabled={pdfLoading} className="rf-btn-primary">
            {pdfLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileDown className="w-4 h-4" />}
            Download PDF
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* All Transactions */}
        <ExportCard
          icon={<FolderOpen className="w-5 h-5" />}
          title="All Transactions"
          description={`${transactions.length} total transactions`}
          onExport={() => downloadTransactionsCSV(transactions, `rupeeflow_all_${today}.csv`)}
          onPDF={() => handleCategoryPDF('all')}
        />

        {/* Category Exports */}
        <div className="rf-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileBarChart className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">Export by Category</h3>
          </div>
          <div className="space-y-2">
            {CATEGORY_EXPORTS.map(({ category, label }) => {
              const txns = transactions.filter((t) => t.category === category);
              return (
                <div key={category} className="flex items-center justify-between py-2 border-b border-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{label}</p>
                    <p className="text-xs text-slate-400">{txns.length} transactions</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => txns.length > 0 && downloadTransactionsCSV(txns, `rupeeflow_${label.toLowerCase().replace(/[^a-z]+/g, '_')}_${today}.csv`)}
                      disabled={txns.length === 0}
                      className="rf-btn-secondary text-xs"
                      title="Download CSV"
                    >
                      <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button
                      onClick={() => handleCategoryPDF(category)}
                      disabled={txns.length === 0}
                      className="rf-btn-secondary text-xs"
                      title="Download PDF"
                    >
                      <FileDown className="w-3.5 h-3.5" /> PDF
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Account Export */}
        <div className="rf-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">Export by Account</h3>
          </div>
          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="rf-select mb-3">
            <option value="all">All Accounts</option>
            {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <p className="text-xs text-slate-400 mb-3">{filteredByAccount.length} transactions in selection</p>
          <div className="flex gap-2">
            <button
              onClick={() => downloadTransactionsCSV(filteredByAccount, `rupeeflow_account_${accountFilter}_${today}.csv`)}
              disabled={filteredByAccount.length === 0}
              className="rf-btn-primary flex-1 justify-center"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
            <button
              onClick={() => filteredByAccount.length > 0 && downloadCategoryPDF({ transactions: filteredByAccount, category: 'all' })}
              disabled={filteredByAccount.length === 0}
              className="rf-btn-secondary flex-1 justify-center"
            >
              <FileDown className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>

        {/* Merchant Export */}
        <div className="rf-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Store className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">Export by Merchant</h3>
          </div>
          <select value={merchantFilter} onChange={(e) => setMerchantFilter(e.target.value)} className="rf-select mb-3">
            <option value="all">All Merchants</option>
            {merchants.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <p className="text-xs text-slate-400 mb-3">{filteredByMerchant.length} transactions in selection</p>
          <div className="flex gap-2">
            <button
              onClick={() => downloadTransactionsCSV(filteredByMerchant, `rupeeflow_merchant_${merchantFilter}_${today}.csv`)}
              disabled={filteredByMerchant.length === 0}
              className="rf-btn-primary flex-1 justify-center"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
            <button
              onClick={() => filteredByMerchant.length > 0 && downloadCategoryPDF({ transactions: filteredByMerchant, category: 'all' })}
              disabled={filteredByMerchant.length === 0}
              className="rf-btn-secondary flex-1 justify-center"
            >
              <FileDown className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>

        {/* Date Range Export */}
        <div className="rf-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">Export by Date Range</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rf-input" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium block mb-1">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rf-input" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            {filteredByDate.length} transactions
            {dateFrom && ` from ${formatDate(dateFrom)}`}
            {dateTo && ` to ${formatDate(dateTo)}`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => downloadTransactionsCSV(filteredByDate, `rupeeflow_daterange_${dateFrom || 'start'}_to_${dateTo || 'end'}.csv`)}
              disabled={filteredByDate.length === 0}
              className="rf-btn-primary flex-1 justify-center"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
            <button
              onClick={handleDateRangePDF}
              disabled={filteredByDate.length === 0}
              className="rf-btn-secondary flex-1 justify-center"
            >
              <FileDown className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>

        {/* Selected Rows */}
        <ExportCard
          icon={<CheckSquare className="w-5 h-5" />}
          title="Export Selected Rows"
          description="Use the checkbox selection on the Transactions page, then use the export button there"
          onExport={undefined}
          note="Visit the Transactions page to select and export individual rows"
        />
      </div>

      {/* Income vs Expense Summary */}
      <div className="rf-card p-5 mt-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Category Summary Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Credits</th>
                <th className="px-4 py-3 text-right">Debits</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3 text-right">Count</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categorySummary.map((c) => (
                <tr key={c.cat} className="hover:bg-blue-50/30">
                  <td className="px-4 py-3 font-medium text-slate-700">{CATEGORY_LABELS[c.cat]}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">{c.credits > 0 ? inr(c.credits) : '—'}</td>
                  <td className="px-4 py-3 text-right text-red-500 font-medium">{c.debits > 0 ? inr(c.debits) : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{inr(c.net)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{c.count}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => downloadTransactionsCSV(c.txns, `rupeeflow_${c.cat}_${today}.csv`)} className="rf-btn-ghost text-xs" title="Download CSV">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleCategoryPDF(c.cat)} className="rf-btn-ghost text-xs" title="Download PDF">
                        <FileDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Report */}
      <div className="rf-card p-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">Monthly Report</h3>
          </div>
          <button onClick={handlePrint} className="rf-btn-secondary text-xs">
            <Printer className="w-3.5 h-3.5" /> Print Report
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3 text-right">Income</th>
                <th className="px-4 py-3 text-right">Expense</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3 text-right">Savings %</th>
                <th className="px-4 py-3 text-right">Txns</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyData.map((m) => {
                const monthTxnCount = monthlyTxnCounts[m.month] ?? 0;
                const savingsPct = m.income > 0 ? Math.round((m.net / m.income) * 100) : 0;
                return (
                  <tr key={m.month} className="hover:bg-blue-50/30">
                    <td className="px-4 py-3 font-medium text-slate-700">{m.month}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{formatINR(m.income)}</td>
                    <td className="px-4 py-3 text-right text-red-500 font-medium">{formatINR(m.expense)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${m.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatINR(m.net)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{savingsPct}%</td>
                    <td className="px-4 py-3 text-right text-slate-500">{monthTxnCount}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => {
                        const monthTxns = transactions.filter((t) => {
                          const d = new Date(t.date);
                          return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) === m.month;
                        });
                        downloadTransactionsCSV(monthTxns, `rupeeflow_monthly_${m.month.replace(/\s/g, '_')}_${today}.csv`);
                      }} className="rf-btn-ghost text-xs">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Loan Report */}
      {loanData.length > 0 && (
        <div className="rf-card p-5 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Landmark className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">Loan & EMI Report</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="px-4 py-3">Loan Name</th>
                  <th className="px-4 py-3">Lender</th>
                  <th className="px-4 py-3 text-right">EMI</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Frequency</th>
                  <th className="px-4 py-3">Next Due</th>
                  <th className="px-4 py-3 text-right">Paid / Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loanData.map((l) => (
                  <tr key={l.id} className="hover:bg-blue-50/30">
                    <td className="px-4 py-3 font-medium text-slate-700">{l.name}</td>
                    <td className="px-4 py-3 text-slate-600">{l.lender}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">{formatINR(l.emi)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatINR(l.amount)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{l.frequency}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(l.dueDate)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{l.paidCount}/{l.totalCount}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => downloadCSV(l.csv, `rupeeflow_loan_${l.name.replace(/[^a-z0-9]+/gi, '_')}_${today}.csv`)} className="rf-btn-ghost text-xs">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ExportCard({ icon, title, description, onExport, onPDF, note }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onExport?: () => void;
  onPDF?: () => void;
  note?: string;
}) {
  return (
    <div className="rf-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">{icon}</div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
      </div>
      {onExport || onPDF ? (
        <div className="flex gap-2">
          {onExport && (
            <button onClick={onExport} className="rf-btn-primary flex-1 justify-center">
              <Download className="w-4 h-4" /> CSV
            </button>
          )}
          {onPDF && (
            <button onClick={onPDF} className="rf-btn-secondary flex-1 justify-center">
              <FileDown className="w-4 h-4" /> PDF
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">{note}</p>
      )}
    </div>
  );
}
