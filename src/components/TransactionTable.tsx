import { Transaction, TransactionCategory, CATEGORY_LABELS, CATEGORY_COLORS } from '@/types';
import { formatINR, formatDate } from '@/utils/format';
import { useState, useMemo } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft, Copy, Edit3, X, Check } from 'lucide-react';

interface TransactionTableProps {
  transactions: Transaction[];
  showFilters?: boolean;
  pageSize?: number;
  onCategoryChange?: (id: string, category: TransactionCategory) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as TransactionCategory[];

export default function TransactionTable({
  transactions,
  showFilters = true,
  pageSize = 25,
  onCategoryChange,
  selectable = false,
  selectedIds,
  onSelectionChange,
}: TransactionTableProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<TransactionCategory>('Uncategorized');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const accounts = useMemo(() => {
    const set = new Set(transactions.map((t) => t.account));
    return Array.from(set).sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    let result = transactions;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) =>
        t.description.toLowerCase().includes(q) ||
        (t.merchant ?? '').toLowerCase().includes(q) ||
        (t.reference ?? '').toLowerCase().includes(q),
      );
    }
    if (categoryFilter !== 'all') result = result.filter((t) => t.category === categoryFilter);
    if (accountFilter !== 'all') result = result.filter((t) => t.account === accountFilter);
    if (typeFilter !== 'all') result = result.filter((t) => t.type === typeFilter);
    if (dateFrom) result = result.filter((t) => t.date >= dateFrom);
    if (dateTo) result = result.filter((t) => t.date <= dateTo);

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'date-asc': return a.date.localeCompare(b.date);
        case 'date-desc': return b.date.localeCompare(a.date);
        case 'amount-asc': return a.amount - b.amount;
        case 'amount-desc': return b.amount - a.amount;
      }
    });
    return result;
  }, [transactions, search, categoryFilter, accountFilter, typeFilter, sortBy, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));
  const pageData = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const detailTxn = detailId ? filtered.find((t) => t.id === detailId) ?? null : null;

  function toggleSelect(id: string) {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  function toggleSelectAll() {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (pageData.every((t) => next.has(t.id))) {
      pageData.forEach((t) => next.delete(t.id));
    } else {
      pageData.forEach((t) => next.add(t.id));
    }
    onSelectionChange(next);
  }

  function saveCategoryChange() {
    if (editingId && onCategoryChange) {
      onCategoryChange(editingId, editCategory);
    }
    setEditingId(null);
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="rf-card p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search description, merchant, reference..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="rf-input pl-10"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
              className="rf-select w-auto"
            >
              <option value="all">All Categories</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <select
              value={accountFilter}
              onChange={(e) => { setAccountFilter(e.target.value); setPage(0); }}
              className="rf-select w-auto"
            >
              <option value="all">All Accounts</option>
              {accounts.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
              className="rf-select w-auto"
            >
              <option value="all">Credit & Debit</option>
              <option value="credit">Credits Only</option>
              <option value="debit">Debits Only</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rf-select w-auto"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Amount: High to Low</option>
              <option value="amount-asc">Amount: Low to High</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium">From:</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="rf-input w-auto text-xs py-1.5" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium">To:</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="rf-input w-auto text-xs py-1.5" />
            </div>
            {(search || categoryFilter !== 'all' || accountFilter !== 'all' || typeFilter !== 'all' || dateFrom || dateTo) && (
              <button
                onClick={() => { setSearch(''); setCategoryFilter('all'); setAccountFilter('all'); setTypeFilter('all'); setDateFrom(''); setDateTo(''); setPage(0); }}
                className="rf-btn-ghost text-xs"
              >
                <Filter className="w-3.5 h-3.5" /> Clear Filters
              </button>
            )}
            <span className="ml-auto text-sm text-slate-500 font-medium">
              {filtered.length} of {transactions.length} transactions
            </span>
          </div>
        </div>
      )}

      <div className="rf-card overflow-hidden">
        {pageData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Search className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No transactions found</p>
            <p className="text-xs mt-1">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  {selectable && (
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={pageData.length > 0 && pageData.every((t) => selectedIds?.has(t.id))}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageData.map((txn) => (
                  <tr
                    key={txn.id}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                    onClick={() => setDetailId(txn.id)}
                  >
                    {selectable && (
                      <td className="px-3 py-3" onClick={(e) => { e.stopPropagation(); toggleSelect(txn.id); }}>
                        <input
                          type="checkbox"
                          checked={selectedIds?.has(txn.id) ?? false}
                          onChange={() => toggleSelect(txn.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">{formatDate(txn.date)}</td>
                    <td className="px-4 py-3 max-w-[280px]">
                      <div className="flex items-center gap-2">
                        {txn.type === 'credit' ? (
                          <ArrowDownLeft className="w-4 h-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}
                        <div className="truncate">
                          <p className="text-slate-800 font-medium truncate">{txn.description}</p>
                          {txn.merchant && <p className="text-xs text-slate-400 truncate">{txn.merchant}</p>}
                        </div>
                        {txn.isDuplicate && (
                          <span className="rf-badge bg-amber-100 text-amber-700" title="Duplicate">
                            <Copy className="w-3 h-3 mr-1" /> Dup
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingId === txn.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value as TransactionCategory)}
                            className="rf-select text-xs py-1 w-auto"
                          >
                            {ALL_CATEGORIES.map((c) => (
                              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                            ))}
                          </select>
                          <button onClick={saveCategoryChange} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="rf-badge"
                            style={{ backgroundColor: `${CATEGORY_COLORS[txn.category]}15`, color: CATEGORY_COLORS[txn.category] }}
                          >
                            {CATEGORY_LABELS[txn.category]}
                          </span>
                          {onCategoryChange && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingId(txn.id); setEditCategory(txn.category); }}
                              className="text-slate-300 hover:text-blue-600"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${txn.type === 'credit' ? 'text-green-600' : 'text-slate-800'}`}>
                      {txn.type === 'credit' ? '+' : '−'}{formatINR(txn.amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{txn.account}</td>
                    <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap text-xs">
                      {txn.balanceAfter !== null ? formatINR(txn.balanceAfter) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDetailId(txn.id); }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <span className="text-xs text-slate-500">
              Page {currentPage + 1} of {totalPages} · Showing {pageData.length} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="rf-btn-ghost p-1.5 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
                className="rf-btn-ghost p-1.5 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {detailTxn && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setDetailId(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Transaction Details</h3>
                <p className="text-sm text-slate-400">{formatDate(detailTxn.date)}</p>
              </div>
              <button onClick={() => setDetailId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <DetailRow label="Description" value={detailTxn.description} />
              <DetailRow label="Type" value={detailTxn.type === 'credit' ? 'Credit (Incoming)' : 'Debit (Outgoing)'} />
              <DetailRow label="Amount" value={formatINR(detailTxn.amount)} highlight={detailTxn.type} />
              <DetailRow label="Category" value={CATEGORY_LABELS[detailTxn.category]} />
              <DetailRow label="Account" value={detailTxn.account} />
              <DetailRow label="Balance After" value={detailTxn.balanceAfter !== null ? formatINR(detailTxn.balanceAfter) : '—'} />
              <DetailRow label="Reference" value={detailTxn.reference ?? '—'} />
              <DetailRow label="Merchant" value={detailTxn.merchant ?? '—'} />
              <DetailRow label="Internal Transfer" value={detailTxn.isInternalTransfer ? 'Yes' : 'No'} />
              <DetailRow label="Duplicate" value={detailTxn.isDuplicate ? 'Yes' : 'No'} />
              <DetailRow label="User Edited" value={detailTxn.userEdited ? 'Yes' : 'No'} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium ${highlight === 'credit' ? 'text-green-600' : highlight === 'debit' ? 'text-slate-800' : 'text-slate-700'}`}>{value}</span>
    </div>
  );
}
