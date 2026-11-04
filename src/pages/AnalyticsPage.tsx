import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell,
} from 'recharts';
import { Transaction, TransactionCategory, CATEGORY_LABELS, CATEGORY_COLORS } from '@/types';
import { computeStats, getCategoryBreakdown } from '@/utils/stats';
import { formatINR, formatCompactINR } from '@/utils/format';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { BarChart3, TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';

interface AnalyticsPageProps {
  transactions: Transaction[];
}

export default function AnalyticsPage({ transactions }: AnalyticsPageProps) {
  const stats = useMemo(() => computeStats(transactions), [transactions]);
  const breakdown = useMemo(() => getCategoryBreakdown(transactions), [transactions]);

  if (transactions.length === 0) {
    return (
      <div>
        <PageHeader title="Financial Analytics" subtitle="Deep-dive into spending patterns and trends" icon={<BarChart3 className="w-5 h-5" />} />
        <div className="rf-card p-12 text-center">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No Data Available</h3>
          <p className="text-sm text-slate-400">Load demo data or import a statement to view analytics.</p>
        </div>
      </div>
    );
  }

  const barData = breakdown.map((b) => ({
    name: CATEGORY_LABELS[b.category as TransactionCategory].length > 15
      ? CATEGORY_LABELS[b.category as TransactionCategory].slice(0, 12) + '...'
      : CATEGORY_LABELS[b.category as TransactionCategory],
    fullName: CATEGORY_LABELS[b.category as TransactionCategory],
    amount: b.total,
    count: b.count,
    fill: CATEGORY_COLORS[b.category as TransactionCategory],
  }));

  const monthlyNetData = stats.monthlyData.map((m) => ({
    month: m.month,
    net: m.net,
    income: m.income,
    expense: m.expense,
  }));

  const totalExpense = breakdown.reduce((a, b) => a + b.total, 0);
  const top3Share = breakdown.slice(0, 3).reduce((a, b) => a + b.total, 0);
  const top3Percent = totalExpense > 0 ? Math.round((top3Share / totalExpense) * 100) : 0;

  const incomeCategories = Object.entries(stats.categoryTotals)
    .filter(([, v]) => v.credit > 0)
    .sort(([, a], [, b]) => b.credit - a.credit);

  const expenseCategories = Object.entries(stats.categoryTotals)
    .filter(([, v]) => v.debit > 0 && v.credit === 0)
    .sort(([, a], [, b]) => b.debit - a.debit);

  return (
    <div>
      <PageHeader title="Financial Analytics" subtitle="Deep-dive into spending patterns and trends" icon={<BarChart3 className="w-5 h-5" />} />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Avg Transaction" value={formatINR(stats.avgAmount)} subtitle={`Median: ${formatINR(stats.medianAmount)}`} icon={<Activity className="w-4 h-4" />} />
        <StatCard title="Avg Debit" value={formatINR(stats.avgDebit)} subtitle={`Per outgoing transaction`} icon={<TrendingDown className="w-4 h-4" />} variant="debit" />
        <StatCard title="Avg Credit" value={formatINR(stats.avgCredit)} subtitle={`Per incoming transaction`} icon={<TrendingUp className="w-4 h-4" />} variant="credit" />
        <StatCard title="Top 3 Share" value={`${top3Percent}%`} subtitle={`of total spending from top 3 categories`} icon={<Zap className="w-4 h-4" />} variant="neutral" />
      </div>

      {/* Category Bar Chart */}
      <div className="rf-card p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Spending Breakdown by Category</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={barData} margin={{ left: 10, right: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} angle={-35} textAnchor="end" height={70} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactINR(v)} />
            <Tooltip
              formatter={(v) => formatINR(Number(v))}
              labelFormatter={(label) => label}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
            />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Trend */}
      <div className="rf-card p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Monthly Net Cash Flow Trend</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={monthlyNetData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactINR(v)} />
            <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            <Line type="monotone" dataKey="net" name="Net Cash Flow" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Income vs Expense Categories + Savings Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rf-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Income Categories</h3>
          <div className="space-y-2">
            {incomeCategories.map(([cat, v]) => (
              <div key={cat} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700">{CATEGORY_LABELS[cat as TransactionCategory]}</span>
                    <span className="text-sm font-medium text-green-600">{formatINR(v.credit)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${stats.externalIncome > 0 ? (v.credit / stats.externalIncome) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {incomeCategories.length === 0 && <p className="text-sm text-slate-400">No income transactions</p>}
          </div>
        </div>

        <div className="rf-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Expense Categories</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {expenseCategories.map(([cat, v]) => (
              <div key={cat} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700">{CATEGORY_LABELS[cat as TransactionCategory]}</span>
                    <span className="text-sm font-medium text-red-500">{formatINR(v.debit)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${totalExpense > 0 ? (v.debit / totalExpense) * 100 : 0}%`, backgroundColor: CATEGORY_COLORS[cat as TransactionCategory] }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {expenseCategories.length === 0 && <p className="text-sm text-slate-400">No expense transactions</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

