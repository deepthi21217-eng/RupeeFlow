import { useMemo, useState } from 'react';
import { Transaction, TransactionCategory } from '@/types';
import TransactionTable from '@/components/TransactionTable';
import PageHeader from '@/components/PageHeader';
import { ArrowRightLeft, Download } from 'lucide-react';
import { downloadTransactionsCSV } from '@/utils/csv';

interface TransactionsPageProps {
  transactions: Transaction[];
  onCategoryChange: (id: string, category: TransactionCategory) => void;
}

export default function TransactionsPage({ transactions, onCategoryChange }: TransactionsPageProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedTxns = useMemo(
    () => transactions.filter((t) => selectedIds.has(t.id)),
    [transactions, selectedIds],
  );

  function handleExportSelected() {
    if (selectedTxns.length === 0) return;
    downloadTransactionsCSV(selectedTxns, `rupeeflow_selected_${selectedTxns.length}_txns.csv`);
  }

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="Search, filter, and explore your transaction history"
        icon={<ArrowRightLeft className="w-5 h-5" />}
        actions={
          selectedIds.size > 0 ? (
            <button onClick={handleExportSelected} className="rf-btn-primary">
              <Download className="w-4 h-4" /> Export Selected ({selectedIds.size})
            </button>
          ) : undefined
        }
      />

      {transactions.length === 0 ? (
        <div className="rf-card p-12 text-center">
          <ArrowRightLeft className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No Transactions</h3>
          <p className="text-sm text-slate-400">Load demo data or import a statement to view transactions.</p>
        </div>
      ) : (
        <>
          <div className="mb-4 text-xs text-slate-500 bg-blue-50/50 border border-blue-100 rounded-lg px-4 py-2">
            <span className="font-medium text-blue-700">{transactions.length}</span> total transactions ·
            Categories can be edited inline by clicking the pencil icon next to any category badge ·
            Select rows to export them individually
          </div>
          <TransactionTable
            transactions={transactions}
            onCategoryChange={onCategoryChange}
            selectable={true}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </>
      )}
    </div>
  );
}
