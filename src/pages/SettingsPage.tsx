import { Transaction, CATEGORY_LABELS, CATEGORY_COLORS, TransactionCategory } from '@/types';
import { downloadTransactionsCSV } from '@/utils/csv';
import PageHeader from '@/components/PageHeader';
import { Settings, Download, Trash2, Info, Database, Tag, Shield } from 'lucide-react';

interface SettingsPageProps {
  transactions: Transaction[];
  onClearAll: () => void;
}

export default function SettingsPage({ transactions, onClearAll }: SettingsPageProps) {
  function handleExportAll() {
    if (transactions.length === 0) return;
    downloadTransactionsCSV(transactions, `rupeeflow_full_backup_${new Date().toISOString().split('T')[0]}.csv`);
  }

  function handleClearData() {
    if (confirm('This will permanently delete all transactions, loans, and transfer matches. This cannot be undone. Continue?')) {
      onClearAll();
    }
  }

  const categories = Object.keys(CATEGORY_LABELS) as TransactionCategory[];
  const userEditedCount = transactions.filter((t) => t.userEdited).length;
  const duplicateCount = transactions.filter((t) => t.isDuplicate).length;
  const internalTransferCount = transactions.filter((t) => t.isInternalTransfer).length;

  return (
    <div>
      <PageHeader title="Profile & Settings" subtitle="Manage your data, categories, and application preferences" icon={<Settings className="w-5 h-5" />} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Data Management */}
        <div className="rf-card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">Data Management</h3>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Total transactions</span>
              <span className="font-medium text-slate-700">{transactions.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">User-edited categories</span>
              <span className="font-medium text-slate-700">{userEditedCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Flagged duplicates</span>
              <span className="font-medium text-slate-700">{duplicateCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Internal transfers</span>
              <span className="font-medium text-slate-700">{internalTransferCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Storage method</span>
              <span className="font-medium text-slate-700">Secure cloud storage</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleExportAll} disabled={transactions.length === 0} className="rf-btn-primary flex-1 justify-center">
              <Download className="w-4 h-4" /> Export All Data
            </button>
            <button onClick={handleClearData} disabled={transactions.length === 0} className="rf-btn-secondary text-red-600 hover:bg-red-50 flex-1 justify-center">
              <Trash2 className="w-4 h-4" /> Clear All Data
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Export creates a complete CSV backup of all transactions. Clearing data removes your transactions,
            category overrides, loans, repayment records, and transfer matches from your account.
          </p>
        </div>

        {/* Category Reference */}
        <div className="rf-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">Category System ({categories.length} categories)</h3>
          </div>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {categories.map((cat) => {
              const count = transactions.filter((t) => t.category === cat).length;
              return (
                <div key={cat} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                    <span className="text-sm text-slate-700">{CATEGORY_LABELS[cat]}</span>
                  </div>
                  <span className="text-xs text-slate-400">{count} txns</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* About / Mode Info */}
      <div className="rf-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-800">About RupeeFlow</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Project</p>
            <p className="text-slate-700">MCA Final Year Project</p>
            <p className="text-xs text-slate-400 mt-0.5">Unified Banking Intelligence & Financial Security Platform</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Stage</p>
            <p className="text-slate-700">Stage 2 — Complete</p>
            <p className="text-xs text-slate-400 mt-0.5">All 11 modules implemented</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mode</p>
            <p className="text-slate-700">Secure Account Mode</p>
            <p className="text-xs text-slate-400 mt-0.5">Your financial data is isolated to your signed-in account.</p>
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="rf-card p-4 mt-6 bg-blue-50/40 border-blue-100">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-700 mb-1">Security & Privacy</p>
            <p className="text-xs">
              Transactions, loans, repayments, and notifications are protected by your signed-in account.
              The Security Analysis module performs rule-based checks only — it does not connect to external
              threat databases. EMI reminders stay inside RupeeFlow; external SMS and email delivery is disabled.
              The Financial Assistant uses a local query engine, not an external AI API.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
