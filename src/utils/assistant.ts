import { Transaction, TransactionCategory, CATEGORY_LABELS } from '@/types';
import { computeStats } from './stats';
import { formatINR, formatDate } from './format';

export interface QueryResult {
  answer: string;
  transactions?: Transaction[];
  calculation?: { label: string; value: string }[];
}

const CATEGORY_SYNONYMS: Record<string, TransactionCategory> = {
  shopping: 'Shopping',
  shop: 'Shopping',
  purchase: 'Shopping',
  education: 'Education',
  college: 'Education',
  tuition: 'Education',
  fee: 'Education',
  fees: 'Education',
  course: 'Education',
  food: 'Food',
  dining: 'Food',
  restaurant: 'Food',
  swiggy: 'Food',
  zomato: 'Food',
  travel: 'Travel',
  trip: 'Travel',
  flight: 'Travel',
  hotel: 'Travel',
  train: 'Transport',
  bus: 'Transport',
  transport: 'Transport',
  uber: 'Transport',
  ola: 'Transport',
  loan: 'Loan_EMI',
  emi: 'Loan_EMI',
  salary: 'Salary',
  income: 'Salary',
  scholarship: 'Scholarship',
  interest: 'Interest',
  utilities: 'Utilities',
  bill: 'Utilities',
  bills: 'Utilities',
  subscription: 'Subscription',
  netflix: 'Subscription',
  spotify: 'Subscription',
  atm: 'ATM_Withdrawal',
  withdrawal: 'ATM_Withdrawal',
  refund: 'Refund',
  transfer: 'Internal_Transfer',
  internal: 'Internal_Transfer',
};

function findCategory(query: string): TransactionCategory | null {
  const q = query.toLowerCase();
  for (const [synonym, cat] of Object.entries(CATEGORY_SYNONYMS)) {
    if (q.includes(synonym)) return cat;
  }
  return null;
}

function findDateRange(query: string): { from?: string; to?: string; label?: string } | null {
  const q = query.toLowerCase();
  const now = new Date();

  if (q.includes('this month')) {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const to = now.toISOString().split('T')[0];
    return { from, to, label: 'this month' };
  }
  if (q.includes('last month')) {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    return { from, to, label: 'last month' };
  }
  if (q.includes('last 3 months') || q.includes('past 3 months') || q.includes('3 months')) {
    const from = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
    return { from, to: now.toISOString().split('T')[0], label: 'the last 3 months' };
  }
  if (q.includes('last 6 months') || q.includes('past 6 months') || q.includes('6 months')) {
    const from = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0];
    return { from, to: now.toISOString().split('T')[0], label: 'the last 6 months' };
  }

  const monthMatch = q.match(/(?:in|for)\s+(\w+)/);
  if (monthMatch) {
    const monthName = monthMatch[1];
    const monthIdx = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].indexOf(monthName);
    if (monthIdx >= 0) {
      const year = monthIdx <= now.getMonth() ? now.getFullYear() : now.getFullYear() - 1;
      const from = new Date(year, monthIdx, 1).toISOString().split('T')[0];
      const to = new Date(year, monthIdx + 1, 0).toISOString().split('T')[0];
      return { from, to, label: monthName };
    }
  }

  return null;
}

export function processQuery(query: string, transactions: Transaction[]): QueryResult {
  const q = query.toLowerCase().trim();

  if (transactions.length === 0) {
    return { answer: 'No transaction data is loaded yet. Please load demo data or import a statement first, then ask me again.' };
  }

  // Duplicates
  if (q.includes('duplicate')) {
    const dups = transactions.filter((t) => t.isDuplicate);
    if (dups.length === 0) {
      return { answer: 'No duplicate transactions were detected in your dataset.' };
    }
    return {
      answer: `I found ${dups.length} potential duplicate transaction(s) in your data. These are records with the same date, amount, type, description, and account. Review them below and remove if needed.`,
      transactions: dups,
      calculation: [{ label: 'Duplicates found', value: String(dups.length) }],
    };
  }

  // Largest transactions
  if (q.includes('largest') || q.includes('biggest') || q.includes('highest') || q.includes('max ')) {
    const stats = computeStats(transactions);
    if (q.includes('incoming') || q.includes('credit') || q.includes('income')) {
      if (stats.largestIncoming) {
        return {
          answer: `Your largest incoming transaction was ${formatINR(stats.largestIncoming.amount)} from "${stats.largestIncoming.description}" on ${formatDate(stats.largestIncoming.date)} to account ${stats.largestIncoming.account}.`,
          transactions: [stats.largestIncoming],
        };
      }
      return { answer: 'No incoming transactions found.' };
    }
    if (q.includes('outgoing') || q.includes('debit') || q.includes('expense') || q.includes('spending')) {
      if (stats.largestOutgoing) {
        return {
          answer: `Your largest outgoing transaction was ${formatINR(stats.largestOutgoing.amount)} for "${stats.largestOutgoing.description}" on ${formatDate(stats.largestOutgoing.date)} from account ${stats.largestOutgoing.account}.`,
          transactions: [stats.largestOutgoing],
        };
      }
      return { answer: 'No outgoing transactions found.' };
    }
    if (stats.largestOutgoing) {
      return {
        answer: `Your largest transaction overall was ${formatINR(stats.largestOutgoing.amount)} for "${stats.largestOutgoing.description}" on ${formatDate(stats.largestOutgoing.date)}.`,
        transactions: [stats.largestOutgoing],
      };
    }
    return { answer: 'No transactions found.' };
  }

  // Total / spending / spent
  if (q.includes('total') || q.includes('how much') || q.includes('spent') || q.includes('spend') || q.includes('spending')) {
    const cat = findCategory(q);
    const dateRange = findDateRange(q);

    let txns = transactions;
    if (dateRange) {
      txns = txns.filter((t) => {
        if (dateRange.from && t.date < dateRange.from) return false;
        if (dateRange.to && t.date > dateRange.to) return false;
        return true;
      });
    }

    if (cat) {
      const catTxns = txns.filter((t) => t.category === cat);
      const total = catTxns.reduce((a, b) => a + b.amount, 0);
      const creditTotal = catTxns.filter((t) => t.type === 'credit').reduce((a, b) => a + b.amount, 0);
      const debitTotal = catTxns.filter((t) => t.type === 'debit').reduce((a, b) => a + b.amount, 0);
      const rangeLabel = dateRange ? ` in ${dateRange.label}` : '';
      return {
        answer: `You have ${catTxns.length} transactions in "${CATEGORY_LABELS[cat]}"${rangeLabel}. Total: ${formatINR(total)}. Credits: ${formatINR(creditTotal)}. Debits: ${formatINR(debitTotal)}.`,
        transactions: catTxns.slice(0, 10),
        calculation: [
          { label: 'Transactions', value: String(catTxns.length) },
          { label: 'Total amount', value: formatINR(total) },
          { label: 'Credits', value: formatINR(creditTotal) },
          { label: 'Debits', value: formatINR(debitTotal) },
        ],
      };
    }

    const stats = computeStats(txns);
    const rangeLabel = dateRange ? ` in ${dateRange.label}` : '';
    return {
      answer: `Here's a summary${rangeLabel}: Total credits ${formatINR(stats.totalCredits)}, total debits ${formatINR(stats.totalDebits)}, net cash flow ${formatINR(stats.netCashFlow)} across ${stats.transactionCount} transactions.`,
      calculation: [
        { label: 'Total credits', value: formatINR(stats.totalCredits) },
        { label: 'Total debits', value: formatINR(stats.totalDebits) },
        { label: 'Net cash flow', value: formatINR(stats.netCashFlow) },
        { label: 'Transactions', value: String(stats.transactionCount) },
        { label: 'External income', value: formatINR(stats.externalIncome) },
        { label: 'External spending', value: formatINR(stats.externalSpending) },
      ],
    };
  }

  // Compare categories
  if (q.includes('compare') || q.includes('comparison') || q.includes('versus') || q.includes('vs ')) {
    const words = q.split(/\s+/);
    const cats: TransactionCategory[] = [];
    for (const w of words) {
      const cat = findCategory(w);
      if (cat && !cats.includes(cat)) cats.push(cat);
    }
    if (cats.length >= 2) {
      const calc: { label: string; value: string }[] = [];
      let answer = 'Category comparison:\n';
      for (const cat of cats) {
        const catTxns = transactions.filter((t) => t.category === cat);
        const total = catTxns.reduce((a, b) => a + b.amount, 0);
        answer += `\n• ${CATEGORY_LABELS[cat]}: ${catTxns.length} transactions, ${formatINR(total)}`;
        calc.push({ label: CATEGORY_LABELS[cat], value: `${formatINR(total)} (${catTxns.length} txns)` });
      }
      return { answer, calculation: calc };
    }
  }

  // Category breakdown
  if (q.includes('category') || q.includes('categories') || q.includes('breakdown') || q.includes('where') || q.includes('distribution')) {
    const stats = computeStats(transactions);
    const calc: { label: string; value: string }[] = [];
    const entries = Object.entries(stats.categoryTotals)
      .sort(([, a], [, b]) => (b.credit + b.debit) - (a.credit + a.debit))
      .slice(0, 8);
    let answer = 'Here is your spending and income breakdown by category:\n';
    for (const [cat, v] of entries) {
      const total = v.credit + v.debit;
      answer += `\n• ${CATEGORY_LABELS[cat as TransactionCategory] ?? cat}: ${formatINR(total)} (${v.count} txns)`;
      calc.push({ label: CATEGORY_LABELS[cat as TransactionCategory] ?? cat, value: `${formatINR(total)} (${v.count})` });
    }
    return { answer, calculation: calc };
  }

  // Average / median
  if (q.includes('average') || q.includes('mean') || q.includes('median')) {
    const stats = computeStats(transactions);
    return {
      answer: `Average transaction amount: ${formatINR(stats.avgAmount)}. Median: ${formatINR(stats.medianAmount)}. Average debit: ${formatINR(stats.avgDebit)}. Average credit: ${formatINR(stats.avgCredit)}.`,
      calculation: [
        { label: 'Average amount', value: formatINR(stats.avgAmount) },
        { label: 'Median amount', value: formatINR(stats.medianAmount) },
        { label: 'Average debit', value: formatINR(stats.avgDebit) },
        { label: 'Average credit', value: formatINR(stats.avgCredit) },
      ],
    };
  }

  // Net cash flow
  if (q.includes('net') || q.includes('cash flow') || q.includes('flow')) {
    const stats = computeStats(transactions);
    return {
      answer: `Your net cash flow is ${formatINR(stats.netCashFlow)}. Total credits: ${formatINR(stats.totalCredits)}. Total debits: ${formatINR(stats.totalDebits)}. Internal transfers (excluded from external totals): ${formatINR(stats.internalTransfers)}.`,
      calculation: [
        { label: 'Net cash flow', value: formatINR(stats.netCashFlow) },
        { label: 'Total credits', value: formatINR(stats.totalCredits) },
        { label: 'Total debits', value: formatINR(stats.totalDebits) },
        { label: 'Internal transfers', value: formatINR(stats.internalTransfers) },
      ],
    };
  }

  // Salary / income
  if (q.includes('salary') || q.includes('income') || q.includes('earn')) {
    const salaryTxns = transactions.filter((t) => t.category === 'Salary');
    const total = salaryTxns.reduce((a, b) => a + b.amount, 0);
    return {
      answer: `You have ${salaryTxns.length} salary/income transactions totaling ${formatINR(total)}. Average salary credit: ${salaryTxns.length > 0 ? formatINR(total / salaryTxns.length) : '—'}.`,
      transactions: salaryTxns.slice(0, 5),
      calculation: [
        { label: 'Salary transactions', value: String(salaryTxns.length) },
        { label: 'Total salary', value: formatINR(total) },
      ],
    };
  }

  // Scholarships
  if (q.includes('scholarship') || q.includes('stipend') || q.includes('grant')) {
    const scholTxns = transactions.filter((t) => t.category === 'Scholarship');
    const total = scholTxns.reduce((a, b) => a + b.amount, 0);
    return {
      answer: `You have ${scholTxns.length} scholarship transactions totaling ${formatINR(total)}.`,
      transactions: scholTxns,
      calculation: [
        { label: 'Scholarship count', value: String(scholTxns.length) },
        { label: 'Total', value: formatINR(total) },
      ],
    };
  }

  // Account-wise
  if (q.includes('account') || q.includes('accounts')) {
    const stats = computeStats(transactions);
    const calc: { label: string; value: string }[] = [];
    let answer = 'Account-wise cash flow:\n';
    for (const [acc, v] of Object.entries(stats.accountCashFlow)) {
      const net = v.credit - v.debit;
      answer += `\n• ${acc}: Credits ${formatINR(v.credit)}, Debits ${formatINR(v.debit)}, Net ${formatINR(net)} (${v.count} txns)`;
      calc.push({ label: acc, value: `${formatINR(net)} (${v.count} txns)` });
    }
    return { answer, calculation: calc };
  }

  // Top merchants
  if (q.includes('merchant') || q.includes('top ') || q.includes('where do i spend')) {
    const stats = computeStats(transactions);
    if (stats.topMerchants.length === 0) {
      return { answer: 'No merchant data available in your transactions.' };
    }
    let answer = 'Your top merchants by spending:\n';
    const calc: { label: string; value: string }[] = [];
    for (const m of stats.topMerchants.slice(0, 5)) {
      answer += `\n• ${m.name}: ${formatINR(m.total)} across ${m.count} transactions`;
      calc.push({ label: m.name, value: `${formatINR(m.total)} (${m.count})` });
    }
    return { answer, calculation: calc };
  }

  // Loan / EMI
  if (q.includes('loan') || q.includes('emi')) {
    const loanTxns = transactions.filter((t) => t.category === 'Loan_EMI');
    const total = loanTxns.reduce((a, b) => a + b.amount, 0);
    return {
      answer: `You have ${loanTxns.length} loan/EMI payments totaling ${formatINR(total)}. Average EMI: ${loanTxns.length > 0 ? formatINR(total / loanTxns.length) : '—'}.`,
      transactions: loanTxns.slice(0, 10),
      calculation: [
        { label: 'EMI payments', value: String(loanTxns.length) },
        { label: 'Total paid', value: formatINR(total) },
      ],
    };
  }

  // Fallback: general summary
  const stats = computeStats(transactions);
  return {
    answer: `I can answer questions about your spending, income, categories, dates, comparisons, duplicates, and more. Here's a quick overview: You have ${stats.transactionCount} transactions. Total credits: ${formatINR(stats.totalCredits)}. Total debits: ${formatINR(stats.totalDebits)}. Net cash flow: ${formatINR(stats.netCashFlow)}.\n\nTry asking: "How much did I spend on food?", "What are my top merchants?", "Show me duplicates", "Compare shopping vs food", or "What is my average transaction?"`,
    calculation: [
      { label: 'Transactions', value: String(stats.transactionCount) },
      { label: 'Total credits', value: formatINR(stats.totalCredits) },
      { label: 'Total debits', value: formatINR(stats.totalDebits) },
    ],
  };
}

export const SUGGESTED_QUESTIONS = [
  'How much did I spend on food?',
  'What are my top merchants?',
  'Show me duplicates',
  'How much did I spend on education?',
  'Compare shopping vs food',
  'What is my average transaction?',
  'What is my net cash flow?',
  'Show me my salary transactions',
  'How much did I spend on travel?',
  'What is my largest outgoing transaction?',
];
