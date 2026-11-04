import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Area, AreaChart,
} from 'recharts';
import { Transaction, CATEGORY_LABELS, CATEGORY_COLORS, TransactionCategory } from '@/types';
import { computeStats, getCategoryBreakdown } from '@/utils/stats';
import { formatINR, formatCompactINR, formatNumber, formatDate } from '@/utils/format';
import StatCard from '@/components/StatCard';
import PageHeader from '@/components/PageHeader';
import {
  TrendingUp, TrendingDown, Wallet, ArrowLeftRight, ArrowDownLeft,
  ArrowUpRight, ShoppingBag, Trophy, Building2, BarChart3,
} from 'lucide-react';

interface DashboardPageProps {
  transactions: Transaction[];
}

export default function DashboardPage({ transactions }: DashboardPageProps) {
  const [dateRange, setDateRange] = useState<'all' | '3m' | '6m'>('all');

  const filteredTxns = useMemo(() => {
    if (dateRange === 'all') return transactions;
    const now = new Date();
    const months = dateRange === '3m' ? 3 : 6;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1);
    return transactions.filter((t) => new Date(t.date) >= cutoff);
  }, [transactions, dateRange]);

  const stats = useMemo(() => computeStats(filteredTxns), [filteredTxns]);
  const categoryBreakdown = useMemo(() => getCategoryBreakdown(filteredTxns), [filteredTxns]);

  if (transactions.length === 0) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Financial overview and exploratory data analysis" icon={<BarChart3 className="w-5 h-5" />} />
        <div className="rf-card p-12 text-center">
          <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No Data Loaded</h3>
          <p className="text-sm text-slate-400">Load demo data or import a statement from the Statement Intelligence page to see your dashboard.</p>
        </div>
      </div>
    );
  }

  const pieData = categoryBreakdown.slice(0, 8).map((c) => ({
    name: CATEGORY_LABELS[c.category as TransactionCategory],
    value: c.total,
    color: CATEGORY_COLORS[c.category as TransactionCategory],
  }));

  const accountData = Object.entries(stats.accountCashFlow).map(([acc, v]) => ({
    account: acc,
    credit: v.credit,
    debit: v.debit,
    net: v.credit - v.debit,
  }));

  const rangeLabel = dateRange === 'all' ? 'All time' : dateRange === '3m' ? 'Last 3 months' : 'Last 6 months';
  const dateSpan = filteredTxns.length > 0
    ? `${formatDate(filteredTxns[filteredTxns.length - 1].date)} – ${formatDate(filteredTxns[0].date)}`
    : '—';

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Financial overview and exploratory data analysis"
        icon={<BarChart3 className="w-5 h-5" />}
        actions={
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value as 'all' | '3m' | '6m')} className="rf-select w-auto">
            <option value="all">All Time</option>
            <option value="6m">Last 6 Months</option>
            <option value="3m">Last 3 Months</option>
          </select>
        }
      />

      <div className="mb-4 text-xs text-slate-500 bg-blue-50/50 border border-blue-100 rounded-lg px-4 py-2">
        <span className="font-medium text-blue-700">Date Range:</span> {rangeLabel} · {dateSpan} · {formatNumber(filteredTxns.length)} transactions analyzed
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Credits" value={formatINR(stats.totalCredits)} subtitle={`${formatNumber(filteredTxns.filter((t) => t.type === 'credit').length)} credit transactions`} icon={<ArrowDownLeft className="w-4 h-4" />} variant="credit" />
        <StatCard title="Total Debits" value={formatINR(stats.totalDebits)} subtitle={`${formatNumber(filteredTxns.filter((t) => t.type === 'debit').length)} debit transactions`} icon={<ArrowUpRight className="w-4 h-4" />} variant="debit" />
        <StatCard title="Net Cash Flow" value={formatINR(stats.netCashFlow)} subtitle={stats.netCashFlow >= 0 ? 'Positive cash flow' : 'Negative cash flow'} icon={<Wallet className="w-4 h-4" />} variant={stats.netCashFlow >= 0 ? 'credit' : 'debit'} />
        <StatCard title="Transaction Count" value={formatNumber(stats.transactionCount)} subtitle={`Avg: ${formatINR(stats.avgAmount)} · Median: ${formatINR(stats.medianAmount)}`} icon={<ArrowLeftRight className="w-4 h-4" />} />
      </div>

      {/* External vs Internal */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="External Income" value={formatINR(stats.externalIncome)} subtitle="Excluding internal transfers" icon={<TrendingUp className="w-4 h-4" />} variant="credit" />
        <StatCard title="External Spending" value={formatINR(stats.externalSpending)} subtitle="Excluding internal transfers" icon={<TrendingDown className="w-4 h-4" />} variant="debit" />
        <StatCard title="Internal Transfers" value={formatINR(stats.internalTransfers)} subtitle="Between own accounts" icon={<ArrowLeftRight className="w-4 h-4" />} variant="neutral" />
      </div>

      {/* Monthly Income vs Expense */}
      <div className="rf-card p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Monthly Income vs Expenses</h3>
        {stats.monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={stats.monthlyData}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactINR(v)} />
              <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2} fill="url(#incomeGrad)" />
              <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </div>

      {/* Category Pie + Account Cash Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rf-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Category-wise Spending</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={2}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>

        <div className="rf-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Account-wise Cash Flow</h3>
          {accountData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={accountData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactINR(v)} />
                <YAxis type="category" dataKey="account" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} width={100} />
                <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="credit" name="Credits" fill="#22c55e" radius={[0, 4, 4, 0]} />
                <Bar dataKey="debit" name="Debits" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </div>

      {/* Category Table + Top Merchants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rf-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Income vs Expense by Category</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {Object.entries(stats.categoryTotals)
              .sort(([, a], [, b]) => (b.credit + b.debit) - (a.credit + a.debit))
              .map(([cat, v]) => (
                <div key={cat} className="flex items-center gap-3 py-2 border-b border-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{CATEGORY_LABELS[cat as TransactionCategory] ?? cat}</p>
                    <p className="text-xs text-slate-400">{v.count} transactions</p>
                  </div>
                  <div className="text-right">
                    {v.credit > 0 && <p className="text-sm font-medium text-green-600">{formatINR(v.credit)}</p>}
                    {v.debit > 0 && <p className="text-sm font-medium text-red-500">{formatINR(v.debit)}</p>}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="rf-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Top Merchants by Spending</h3>
          {stats.topMerchants.length > 0 ? (
            <div className="space-y-2">
              {stats.topMerchants.map((m, i) => (
                <div key={m.name} className="flex items-center gap-3 py-2 border-b border-slate-50">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{m.name}</p>
                    <p className="text-xs text-slate-400">{m.count} transactions</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-700">{formatINR(m.total)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No merchant data available</p>
          )}
        </div>
      </div>

      {/* Notable Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rf-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-green-600" /> Largest Incoming Transaction
          </h3>
          {stats.largestIncoming ? (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">{stats.largestIncoming.description}</p>
                <p className="text-xs text-slate-400">{formatDate(stats.largestIncoming.date)} · {stats.largestIncoming.account}</p>
              </div>
              <p className="text-lg font-bold text-green-600">{formatINR(stats.largestIncoming.amount)}</p>
            </div>
          ) : <p className="text-sm text-slate-400">No incoming transactions</p>}
        </div>

        <div className="rf-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-red-500" /> Largest Outgoing Transaction
          </h3>
          {stats.largestOutgoing ? (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">{stats.largestOutgoing.description}</p>
                <p className="text-xs text-slate-400">{formatDate(stats.largestOutgoing.date)} · {stats.largestOutgoing.account}</p>
              </div>
              <p className="text-lg font-bold text-red-500">{formatINR(stats.largestOutgoing.amount)}</p>
            </div>
          ) : <p className="text-sm text-slate-400">No outgoing transactions</p>}
        </div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[280px] text-slate-300">
      <div className="text-center">
        <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-xs">No data available</p>
      </div>
    </div>
  );
}
