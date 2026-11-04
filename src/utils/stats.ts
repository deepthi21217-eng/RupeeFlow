import { Transaction, DashboardStats, TransactionCategory } from '@/types';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function monthKey(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export function computeStats(transactions: Transaction[]): DashboardStats {
  let totalCredits = 0;
  let totalDebits = 0;
  let externalIncome = 0;
  let externalSpending = 0;
  let internalTransfers = 0;
  const categoryTotals: Record<string, { credit: number; debit: number; count: number }> = {};
  const accountCashFlow: Record<string, { credit: number; debit: number; count: number }> = {};
  const merchantTotals: Record<string, { total: number; count: number }> = {};
  const monthlyMap: Record<string, { income: number; expense: number }> = {};
  const allAmounts: number[] = [];
  const debitAmounts: number[] = [];
  const creditAmounts: number[] = [];
  let largestIncoming: Transaction | null = null;
  let largestOutgoing: Transaction | null = null;

  for (const txn of transactions) {
    allAmounts.push(txn.amount);
    if (txn.type === 'credit') {
      totalCredits += txn.amount;
      creditAmounts.push(txn.amount);
      if (largestIncoming === null || txn.amount > largestIncoming.amount) {
        largestIncoming = txn;
      }
    } else {
      totalDebits += txn.amount;
      debitAmounts.push(txn.amount);
      if (largestOutgoing === null || txn.amount > largestOutgoing.amount) {
        largestOutgoing = txn;
      }
    }

    if (txn.isInternalTransfer) {
      internalTransfers += txn.amount;
    } else if (txn.type === 'credit') {
      externalIncome += txn.amount;
    } else {
      externalSpending += txn.amount;
    }

    const catKey = txn.category;
    if (!categoryTotals[catKey]) {
      categoryTotals[catKey] = { credit: 0, debit: 0, count: 0 };
    }
    if (txn.type === 'credit') {
      categoryTotals[catKey].credit += txn.amount;
    } else {
      categoryTotals[catKey].debit += txn.amount;
    }
    categoryTotals[catKey].count += 1;

    if (!accountCashFlow[txn.account]) {
      accountCashFlow[txn.account] = { credit: 0, debit: 0, count: 0 };
    }
    if (txn.type === 'credit') {
      accountCashFlow[txn.account].credit += txn.amount;
    } else {
      accountCashFlow[txn.account].debit += txn.amount;
    }
    accountCashFlow[txn.account].count += 1;

    if (txn.merchant && txn.type === 'debit') {
      if (!merchantTotals[txn.merchant]) {
        merchantTotals[txn.merchant] = { total: 0, count: 0 };
      }
      merchantTotals[txn.merchant].total += txn.amount;
      merchantTotals[txn.merchant].count += 1;
    }

    const mk = monthKey(txn.date);
    if (mk) {
      if (!monthlyMap[mk]) monthlyMap[mk] = { income: 0, expense: 0 };
      if (txn.type === 'credit' && !txn.isInternalTransfer) {
        monthlyMap[mk].income += txn.amount;
      } else if (txn.type === 'debit' && !txn.isInternalTransfer) {
        monthlyMap[mk].expense += txn.amount;
      }
    }
  }

  const monthlyData = Object.entries(monthlyMap)
    .map(([month, v]) => ({ month, income: v.income, expense: v.expense, net: v.income - v.expense }))
    .sort((a, b) => {
      const da = new Date(a.month);
      const db = new Date(b.month);
      return da.getTime() - db.getTime();
    });

  const topMerchants = Object.entries(merchantTotals)
    .map(([name, v]) => ({ name, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    totalCredits,
    totalDebits,
    netCashFlow: totalCredits - totalDebits,
    transactionCount: transactions.length,
    externalIncome,
    externalSpending,
    internalTransfers,
    categoryTotals,
    avgAmount: allAmounts.length > 0 ? allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length : 0,
    medianAmount: median(allAmounts),
    avgDebit: debitAmounts.length > 0 ? debitAmounts.reduce((a, b) => a + b, 0) / debitAmounts.length : 0,
    avgCredit: creditAmounts.length > 0 ? creditAmounts.reduce((a, b) => a + b, 0) / creditAmounts.length : 0,
    largestIncoming,
    largestOutgoing,
    accountCashFlow,
    topMerchants,
    monthlyData,
  };
}

export function getCategoryTotal(
  stats: DashboardStats,
  category: TransactionCategory,
  type: 'credit' | 'debit' | 'both' = 'both',
): number {
  const ct = stats.categoryTotals[category];
  if (!ct) return 0;
  if (type === 'credit') return ct.credit;
  if (type === 'debit') return ct.debit;
  return ct.credit + ct.debit;
}

export function getCategoryBreakdown(transactions: Transaction[]): { category: TransactionCategory; total: number; count: number }[] {
  const map: Record<string, { total: number; count: number }> = {};
  for (const txn of transactions) {
    if (txn.isInternalTransfer) continue;
    if (txn.type === 'debit') {
      if (!map[txn.category]) map[txn.category] = { total: 0, count: 0 };
      map[txn.category].total += txn.amount;
      map[txn.category].count += 1;
    }
  }
  return Object.entries(map)
    .map(([category, v]) => ({ category: category as TransactionCategory, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);
}
