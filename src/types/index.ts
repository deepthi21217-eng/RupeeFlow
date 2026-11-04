export type TransactionType = 'credit' | 'debit';

export type TransactionCategory =
  | 'P2P'
  | 'P2M'
  | 'M2P'
  | 'Education'
  | 'Shopping'
  | 'Food'
  | 'Travel'
  | 'Transport'
  | 'Loan_EMI'
  | 'Salary'
  | 'Scholarship'
  | 'Interest'
  | 'Utilities'
  | 'Subscription'
  | 'Internal_Transfer'
  | 'Refund'
  | 'ATM_Withdrawal'
  | 'Credit_Card_Payment'
  | 'Other'
  | 'Uncategorized';

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  P2P: 'Person-to-Person',
  P2M: 'Person-to-Merchant',
  M2P: 'Merchant-to-Person',
  Education: 'Education & College Fees',
  Shopping: 'Shopping',
  Food: 'Food & Dining',
  Travel: 'Travel & Transport',
  Transport: 'Bus, Train & Flight',
  Loan_EMI: 'Loan & EMI',
  Salary: 'Salary & Income',
  Scholarship: 'Scholarship Received',
  Interest: 'Interest Received',
  Utilities: 'Utilities & Bills',
  Subscription: 'Subscriptions',
  Internal_Transfer: 'Internal Transfer',
  Refund: 'Refund',
  ATM_Withdrawal: 'ATM Withdrawal',
  Credit_Card_Payment: 'Credit Card Bill Payment',
  Other: 'Other Payments',
  Uncategorized: 'Uncategorized',
};

export const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  P2P: '#6366f1',
  P2M: '#3b82f6',
  M2P: '#22c55e',
  Education: '#f59e0b',
  Shopping: '#ec4899',
  Food: '#ef4444',
  Travel: '#06b6d4',
  Transport: '#0ea5e9',
  Loan_EMI: '#dc2626',
  Salary: '#16a34a',
  Scholarship: '#84cc16',
  Interest: '#10b981',
  Utilities: '#7c3aed',
  Subscription: '#f97316',
  Internal_Transfer: '#6b7280',
  Refund: '#14b8a6',
  ATM_Withdrawal: '#a855f7',
  Credit_Card_Payment: '#e11d48',
  Other: '#64748b',
  Uncategorized: '#94a3b8',
};

export interface BankAccount {
  id: string;
  accountNumber: string;
  accountHolder: string;
  bankName: string;
  accountType: 'Savings' | 'Current' | 'Salary';
  ifsc: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  category: TransactionCategory;
  account: string;
  balanceAfter: number | null;
  reference: string | null;
  merchant: string | null;
  isDuplicate: boolean;
  isInternalTransfer: boolean;
  userEdited: boolean;
}

export interface UploadedTransaction {
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  account: string;
  balanceAfter: number | null;
  reference: string | null;
  merchant: string | null;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: string[];
  transactions: UploadedTransaction[];
}

export interface DashboardStats {
  totalCredits: number;
  totalDebits: number;
  netCashFlow: number;
  transactionCount: number;
  externalIncome: number;
  externalSpending: number;
  internalTransfers: number;
  categoryTotals: Record<string, { credit: number; debit: number; count: number }>;
  avgAmount: number;
  medianAmount: number;
  avgDebit: number;
  avgCredit: number;
  largestIncoming: Transaction | null;
  largestOutgoing: Transaction | null;
  accountCashFlow: Record<string, { credit: number; debit: number; count: number }>;
  topMerchants: { name: string; total: number; count: number }[];
  monthlyData: { month: string; income: number; expense: number; net: number }[];
}

export type PageId =
  | 'dashboard'
  | 'statement'
  | 'transactions'
  | 'analytics'
  | 'loans'
  | 'security'
  | 'assistant'
  | 'reports'
  | 'travel'
  | 'settings';
