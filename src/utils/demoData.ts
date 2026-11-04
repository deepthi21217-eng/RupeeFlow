import { Transaction, TransactionCategory, BankAccount } from '@/types';
import { categorize } from './categorize';
import { uuidSimple } from './uuid';

export const DEMO_ACCOUNTS: BankAccount[] = [
  {
    id: 'acc1',
    accountNumber: 'XXXXXX7845',
    accountHolder: 'Rahul Sharma',
    bankName: 'HDFC Bank',
    accountType: 'Salary',
    ifsc: 'HDFC0001234',
  },
  {
    id: 'acc2',
    accountNumber: 'XXXXXX3092',
    accountHolder: 'Rahul Sharma',
    bankName: 'State Bank of India',
    accountType: 'Savings',
    ifsc: 'SBIN0005678',
  },
  {
    id: 'acc3',
    accountNumber: 'XXXXXX5517',
    accountHolder: 'Rahul Sharma',
    bankName: 'ICICI Bank',
    accountType: 'Savings',
    ifsc: 'ICIC0009012',
  },
];

interface TemplateDef {
  description: string;
  type: 'credit' | 'debit';
  minAmount: number;
  maxAmount: number;
  category?: TransactionCategory;
  merchant?: string | null;
  frequency?: number;
  accountWeights?: number[];
  recurring?: boolean;
}

const TEMPLATES: TemplateDef[] = [
  // Salary
  { description: 'ACC SALARY CREDIT INFOSYS LTD', type: 'credit', minAmount: 52000, maxAmount: 58000, category: 'Salary', merchant: 'INFOSYS LTD', frequency: 5, accountWeights: [0, 0, 1], recurring: true },
  { description: 'SALARY CREDIT TCS SOLUTIONS', type: 'credit', minAmount: 45000, maxAmount: 50000, category: 'Salary', merchant: 'TCS', frequency: 5, accountWeights: [1, 0, 0], recurring: true },
  // Scholarships
  { description: 'AICTE SCHOLARSHIP CREDIT', type: 'credit', minAmount: 12000, maxAmount: 18000, category: 'Scholarship', merchant: 'AICTE', frequency: 3, accountWeights: [0, 1, 0] },
  { description: 'PRAGATI SCHOLARSHIP DISBURSEMENT', type: 'credit', minAmount: 10000, maxAmount: 15000, category: 'Scholarship', merchant: 'PRAGATI', frequency: 2, accountWeights: [0, 1, 0] },
  // Interest
  { description: 'INT SAVINGS AC CREDIT QTR', type: 'credit', minAmount: 150, maxAmount: 850, category: 'Interest', merchant: null, frequency: 6, accountWeights: [0, 1, 0], recurring: true },
  { description: 'FD INTEREST CREDIT MATURITY', type: 'credit', minAmount: 2000, maxAmount: 5000, category: 'Interest', merchant: null, frequency: 2, accountWeights: [1, 0, 0] },
  // Education
  { description: 'COLLEGE TUITION FEE SEM PAYMENT', type: 'debit', minAmount: 25000, maxAmount: 45000, category: 'Education', merchant: 'VIT UNIVERSITY', frequency: 2, accountWeights: [1, 0, 0], recurring: true },
  { description: 'EXAM FEE REGISTRATION PAYMENT', type: 'debit', minAmount: 1500, maxAmount: 3500, category: 'Education', merchant: 'UNIVERSITY EXAM CELL', frequency: 4, accountWeights: [1, 0, 0] },
  { description: 'UDEMY COURSE PURCHASE ONLINE', type: 'debit', minAmount: 499, maxAmount: 2999, category: 'Education', merchant: 'UDEMY', frequency: 8, accountWeights: [0, 1, 0] },
  { description: 'COURSERA PLUS SUBSCRIPTION ANNUAL', type: 'debit', minAmount: 3500, maxAmount: 5500, category: 'Education', merchant: 'COURSERA', frequency: 2, accountWeights: [0, 1, 0] },
  { description: 'HOSTEL MESS FEES MONTHLY', type: 'debit', minAmount: 3500, maxAmount: 5500, category: 'Education', merchant: 'HOSTEL OFFICE', frequency: 5, accountWeights: [1, 0, 0], recurring: true },
  { description: 'BYJUS LEARNING APP PAYMENT', type: 'debit', minAmount: 2000, maxAmount: 5000, category: 'Education', merchant: 'BYJUS', frequency: 3, accountWeights: [0, 1, 0] },
  // Loan & EMI
  { description: 'HDFC EDUCATION LOAN EMI DR', type: 'debit', minAmount: 8500, maxAmount: 9500, category: 'Loan_EMI', merchant: 'HDFC LOAN', frequency: 5, accountWeights: [1, 0, 0], recurring: true },
  { description: 'SBI AUTO LOAN EMI DEDUCTION', type: 'debit', minAmount: 12000, maxAmount: 13000, category: 'Loan_EMI', merchant: 'SBI LOAN', frequency: 5, accountWeights: [0, 1, 0], recurring: true },
  // Shopping
  { description: 'AMAZON IN PURCHASE ORDER', type: 'debit', minAmount: 299, maxAmount: 15000, category: 'Shopping', merchant: 'AMAZON', frequency: 30, accountWeights: [0, 1, 0] },
  { description: 'FLIPKART ORDER PAYMENT', type: 'debit', minAmount: 399, maxAmount: 12000, category: 'Shopping', merchant: 'FLIPKART', frequency: 25, accountWeights: [1, 0, 0] },
  { description: 'MYNTRA FASHION PURCHASE', type: 'debit', minAmount: 599, maxAmount: 8000, category: 'Shopping', merchant: 'MYNTRA', frequency: 12, accountWeights: [0, 0, 1] },
  { description: 'AJIO ONLINE SHOPPING PAYMENT', type: 'debit', minAmount: 499, maxAmount: 6000, category: 'Shopping', merchant: 'AJIO', frequency: 8, accountWeights: [0, 0, 1] },
  { description: 'CROMA ELECTRONICS PURCHASE', type: 'debit', minAmount: 1500, maxAmount: 45000, category: 'Shopping', merchant: 'CROMA', frequency: 5, accountWeights: [1, 0, 0] },
  { description: 'DMART GROCERY & RETAIL', type: 'debit', minAmount: 500, maxAmount: 5000, category: 'Shopping', merchant: 'DMART', frequency: 15, accountWeights: [0, 1, 0] },
  { description: 'DECATHLON SPORTS PURCHASE', type: 'debit', minAmount: 699, maxAmount: 7000, category: 'Shopping', merchant: 'DECATHLON', frequency: 4, accountWeights: [0, 0, 1] },
  // Food & Dining
  { description: 'SWIGGY FOOD ORDER DELIVERY', type: 'debit', minAmount: 99, maxAmount: 800, category: 'Food', merchant: 'SWIGGY', frequency: 45, accountWeights: [1, 0, 0] },
  { description: 'ZOMATO FOOD DELIVERY ORDER', type: 'debit', minAmount: 120, maxAmount: 1200, category: 'Food', merchant: 'ZOMATO', frequency: 40, accountWeights: [0, 1, 0] },
  { description: 'DOMINOS PIZZA ORDER ONLINE', type: 'debit', minAmount: 199, maxAmount: 1500, category: 'Food', merchant: 'DOMINOS', frequency: 10, accountWeights: [0, 0, 1] },
  { description: 'STARBUCKS COFFEE PURCHASE', type: 'debit', minAmount: 150, maxAmount: 600, category: 'Food', merchant: 'STARBUCKS', frequency: 12, accountWeights: [0, 0, 1] },
  { description: 'BIGBASKET GROCERY DELIVERY', type: 'debit', minAmount: 300, maxAmount: 3500, category: 'Food', merchant: 'BIGBASKET', frequency: 20, accountWeights: [0, 1, 0] },
  { description: 'BLINKIT INSTANT GROCERY', type: 'debit', minAmount: 50, maxAmount: 1500, category: 'Food', merchant: 'BLINKIT', frequency: 18, accountWeights: [1, 0, 0] },
  // Travel
  { description: 'IRCTC TRAIN TICKET BOOKING', type: 'debit', minAmount: 120, maxAmount: 2500, category: 'Travel', merchant: 'IRCTC', frequency: 8, accountWeights: [0, 1, 0] },
  { description: 'MAKEMYTRIP FLIGHT BOOKING', type: 'debit', minAmount: 2500, maxAmount: 15000, category: 'Travel', merchant: 'MAKEMYTRIP', frequency: 4, accountWeights: [1, 0, 0] },
  { description: 'OYO HOTEL BOOKING ROOM', type: 'debit', minAmount: 999, maxAmount: 5000, category: 'Travel', merchant: 'OYO', frequency: 3, accountWeights: [0, 0, 1] },
  { description: 'INDIGO AIRLINE FLIGHT TICKET', type: 'debit', minAmount: 3000, maxAmount: 12000, category: 'Travel', merchant: 'INDIGO', frequency: 3, accountWeights: [1, 0, 0] },
  // Transport
  { description: 'UBER CAB RIDE PAYMENT', type: 'debit', minAmount: 80, maxAmount: 500, category: 'Transport', merchant: 'UBER', frequency: 30, accountWeights: [1, 0, 0] },
  { description: 'OLA CABS RIDE PAYMENT', type: 'debit', minAmount: 70, maxAmount: 450, category: 'Transport', merchant: 'OLA', frequency: 25, accountWeights: [0, 1, 0] },
  { description: 'RAPIDO BIKE RIDE', type: 'debit', minAmount: 40, maxAmount: 200, category: 'Transport', merchant: 'RAPIDO', frequency: 20, accountWeights: [0, 0, 1] },
  { description: 'REDBUS BUS TICKET ONLINE', type: 'debit', minAmount: 150, maxAmount: 1500, category: 'Transport', merchant: 'REDBUS', frequency: 5, accountWeights: [0, 1, 0] },
  { description: 'FASTAG TOLL PAYMENT', type: 'debit', minAmount: 35, maxAmount: 300, category: 'Transport', merchant: 'FASTAG', frequency: 12, accountWeights: [0, 1, 0] },
  { description: 'HP PETROL FUEL PAYMENT', type: 'debit', minAmount: 500, maxAmount: 3000, category: 'Transport', merchant: 'HP PETROL', frequency: 8, accountWeights: [1, 0, 0] },
  // Utilities
  { description: 'TATA POWER ELECTRICITY BILL', type: 'debit', minAmount: 800, maxAmount: 3500, category: 'Utilities', merchant: 'TATA POWER', frequency: 5, accountWeights: [0, 1, 0], recurring: true },
  { description: 'MAHANAGAR GAS BILL PAYMENT', type: 'debit', minAmount: 300, maxAmount: 1200, category: 'Utilities', merchant: 'MGL', frequency: 5, accountWeights: [0, 1, 0], recurring: true },
  { description: 'AIRTEL BROADBAND BILL PAYMENT', type: 'debit', minAmount: 999, maxAmount: 1499, category: 'Utilities', merchant: 'AIRTEL', frequency: 5, accountWeights: [1, 0, 0], recurring: true },
  { description: 'JIO MOBILE RECHARGE PREPAID', type: 'debit', minAmount: 199, maxAmount: 799, category: 'Utilities', merchant: 'JIO', frequency: 8, accountWeights: [0, 1, 0], recurring: true },
  { description: 'TATA SKY DTH RECHARGE', type: 'debit', minAmount: 300, maxAmount: 800, category: 'Utilities', merchant: 'TATA SKY', frequency: 5, accountWeights: [0, 0, 1], recurring: true },
  // Subscriptions
  { description: 'NETFLIX MONTHLY SUBSCRIPTION', type: 'debit', minAmount: 199, maxAmount: 649, category: 'Subscription', merchant: 'NETFLIX', frequency: 5, accountWeights: [1, 0, 0], recurring: true },
  { description: 'AMAZON PRIME SUBSCRIPTION', type: 'debit', minAmount: 149, maxAmount: 1499, category: 'Subscription', merchant: 'AMAZON PRIME', frequency: 3, accountWeights: [0, 1, 0], recurring: true },
  { description: 'SPOTIFY PREMIUM SUBSCRIPTION', type: 'debit', minAmount: 119, maxAmount: 719, category: 'Subscription', merchant: 'SPOTIFY', frequency: 5, accountWeights: [0, 0, 1], recurring: true },
  { description: 'ADOBE CREATIVE CLOUD MONTHLY', type: 'debit', minAmount: 800, maxAmount: 1600, category: 'Subscription', merchant: 'ADOBE', frequency: 5, accountWeights: [0, 0, 1], recurring: true },
  // ATM
  { description: 'ATM CASH WITHDRAWAL HDFC', type: 'debit', minAmount: 1000, maxAmount: 10000, category: 'ATM_Withdrawal', merchant: null, frequency: 12, accountWeights: [1, 0, 0] },
  { description: 'ATM CASH WITHDRAWAL SBI', type: 'debit', minAmount: 500, maxAmount: 10000, category: 'ATM_Withdrawal', merchant: null, frequency: 10, accountWeights: [0, 1, 0] },
  // Credit Card Bill Payments
  { description: 'HDFC CREDIT CARD AUTOPAY DR', type: 'debit', minAmount: 5000, maxAmount: 25000, category: 'Credit_Card_Payment', merchant: 'HDFC BANK', frequency: 5, accountWeights: [1, 0, 0], recurring: true },
  { description: 'ICICI CREDIT CARD BILL PAYMENT', type: 'debit', minAmount: 3000, maxAmount: 18000, category: 'Credit_Card_Payment', merchant: 'ICICI BANK', frequency: 5, accountWeights: [0, 1, 0], recurring: true },
  { description: 'SBI CREDIT CARD AUTO DEBIT', type: 'debit', minAmount: 2000, maxAmount: 15000, category: 'Credit_Card_Payment', merchant: 'SBI CARD', frequency: 4, accountWeights: [0, 0, 1], recurring: true },
  // P2P
  { description: 'UPI SENT TO PRIYA SHARMA', type: 'debit', minAmount: 100, maxAmount: 5000, category: 'P2P', merchant: null, frequency: 20, accountWeights: [1, 0, 0] },
  { description: 'UPI SENT TO ROHIT KUMAR', type: 'debit', minAmount: 200, maxAmount: 3000, category: 'P2P', merchant: null, frequency: 15, accountWeights: [0, 1, 0] },
  { description: 'UPI RECEIVED FROM ANJALI SINGH', type: 'credit', minAmount: 100, maxAmount: 4000, category: 'P2P', merchant: null, frequency: 15, accountWeights: [0, 0, 1] },
  { description: 'UPI RECEIVED FROM VIKRAM REDDY', type: 'credit', minAmount: 200, maxAmount: 5000, category: 'P2P', merchant: null, frequency: 12, accountWeights: [1, 0, 0] },
  { description: 'IMPS SENT TO MOTHER', type: 'debit', minAmount: 1000, maxAmount: 15000, category: 'P2P', merchant: null, frequency: 8, accountWeights: [0, 1, 0] },
  { description: 'IMPS RECEIVED FROM BROTHER', type: 'credit', minAmount: 500, maxAmount: 10000, category: 'P2P', merchant: null, frequency: 6, accountWeights: [0, 0, 1] },
  // P2M
  { description: 'POS DEBIT BHARATPE MERCHANT', type: 'debit', minAmount: 50, maxAmount: 2000, category: 'P2M', merchant: 'BHARATPE', frequency: 15, accountWeights: [1, 0, 0] },
  { description: 'CARD SWIPE DEBIT PURCHASE', type: 'debit', minAmount: 100, maxAmount: 5000, category: 'P2M', merchant: 'POS TERMINAL', frequency: 12, accountWeights: [0, 1, 0] },
  { description: 'UPI PAYMENT TO TEA SHOP', type: 'debit', minAmount: 10, maxAmount: 80, category: 'P2M', merchant: 'TEA SHOP', frequency: 25, accountWeights: [1, 0, 0] },
  { description: 'UPI PAYMENT TO PHARMACY', type: 'debit', minAmount: 50, maxAmount: 800, category: 'P2M', merchant: 'PHARMACY', frequency: 10, accountWeights: [0, 1, 0] },
  { description: 'UPI PAYMENT TO LOCAL KIRANA', type: 'debit', minAmount: 30, maxAmount: 600, category: 'P2M', merchant: 'LOCAL KIRANA', frequency: 15, accountWeights: [0, 0, 1] },
  { description: 'UPI PAYMENT TO RESTAURANT', type: 'debit', minAmount: 80, maxAmount: 1200, category: 'P2M', merchant: 'RESTAURANT', frequency: 12, accountWeights: [1, 0, 0] },
  // Refunds
  { description: 'AMAZON REFUND CREDIT', type: 'credit', minAmount: 199, maxAmount: 8000, category: 'Refund', merchant: 'AMAZON', frequency: 8, accountWeights: [0, 1, 0] },
  { description: 'FLIPKART REFUND PROCESSED', type: 'credit', minAmount: 299, maxAmount: 6000, category: 'Refund', merchant: 'FLIPKART', frequency: 5, accountWeights: [1, 0, 0] },
  { description: 'SWIGGY ORDER CANCEL REFUND', type: 'credit', minAmount: 99, maxAmount: 500, category: 'Refund', merchant: 'SWIGGY', frequency: 4, accountWeights: [1, 0, 0] },
  // Internal Transfers
  { description: 'INTERNAL TRANSFER TO SAVINGS', type: 'debit', minAmount: 2000, maxAmount: 20000, category: 'Internal_Transfer', merchant: null, frequency: 6, accountWeights: [1, 0, 0] },
  { description: 'INTERNAL TRANSFER FROM SALARY', type: 'credit', minAmount: 2000, maxAmount: 20000, category: 'Internal_Transfer', merchant: null, frequency: 6, accountWeights: [0, 1, 0] },
  { description: 'SELF TRANSFER UPI LINKED ACCOUNT', type: 'debit', minAmount: 1000, maxAmount: 15000, category: 'Internal_Transfer', merchant: null, frequency: 4, accountWeights: [0, 0, 1] },
  // Other
  { description: 'MISC PAYMENT ONLINE', type: 'debit', minAmount: 50, maxAmount: 2000, category: 'Other', merchant: null, frequency: 8, accountWeights: [0, 0, 1] },
];

const ACCOUNT_NUMBERS: Record<string, string> = {
  acc1: 'XXXXXX7845',
  acc2: 'XXXXXX3092',
  acc3: 'XXXXXX5517',
};

const ACCOUNTS = ['acc1', 'acc2', 'acc3'];

function randomAmount(min: number, max: number): number {
  const base = Math.random() * (max - min) + min;
  return Math.round(base / 10) * 10;
}

function randomDate(start: Date, end: Date): Date {
  const s = start.getTime();
  const e = end.getTime();
  return new Date(s + Math.random() * (e - s));
}

function pickAccount(weights: number[]): string {
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i] ?? (1 / weights.length);
    if (r <= cumulative) return ACCOUNTS[i];
  }
  return ACCOUNTS[0];
}

function generateReference(): string {
  return `REF${Math.floor(Math.random() * 9000000 + 1000000)}`;
}

export function generateDemoData(): Transaction[] {
  const transactions: Transaction[] = [];
  const startDate = new Date(2025, 0, 1);
  const endDate = new Date(2025, 9, 15);
  const accountBalances: Record<string, number> = {
    acc1: 25000,
    acc2: 40000,
    acc3: 15000,
  };

  const txnMap: { date: Date; amount: number; type: string; description: string; account: string; merchant: string | null; category: TransactionCategory; reference: string }[] = [];

  for (const template of TEMPLATES) {
    const count = template.frequency ?? 5;
    for (let i = 0; i < count; i++) {
      const date = randomDate(startDate, endDate);
      const amount = randomAmount(template.minAmount, template.maxAmount);
      const account = pickAccount(template.accountWeights ?? [0.33, 0.33, 0.34]);
      const reference = generateReference();
      const category = template.category ?? categorize(template.description, template.type, template.merchant ?? null, reference);
      txnMap.push({
        date,
        amount,
        type: template.type,
        description: template.description,
        account,
        merchant: template.merchant ?? null,
        category,
        reference,
      });
    }
  }

  txnMap.sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const txn of txnMap) {
    const accountNum = ACCOUNT_NUMBERS[txn.account];
    if (txn.type === 'debit') {
      accountBalances[txn.account] -= txn.amount;
    } else {
      accountBalances[txn.account] += txn.amount;
    }
    transactions.push({
      id: uuidSimple(),
      date: txn.date.toISOString().split('T')[0],
      description: txn.description,
      type: txn.type as 'credit' | 'debit',
      amount: txn.amount,
      category: txn.category,
      account: accountNum,
      balanceAfter: accountBalances[txn.account],
      reference: txn.reference,
      merchant: txn.merchant,
      isDuplicate: false,
      isInternalTransfer: txn.category === 'Internal_Transfer',
      userEdited: false,
    });
  }

  // Add deliberate duplicates (3-4 records)
  if (transactions.length > 10) {
    const dup1 = { ...transactions[50], id: uuidSimple() };
    const dup2 = { ...transactions[120], id: uuidSimple() };
    const dup3 = { ...transactions[200], id: uuidSimple() };
    transactions.push(dup1, dup2, dup3);
    dup1.isDuplicate = true;
    dup2.isDuplicate = true;
    dup3.isDuplicate = true;
  }

  return transactions;
}
