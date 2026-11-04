import { TransactionCategory } from './index';

export interface Loan {
  id: string;
  name: string;
  lender: string;
  amount: number;
  category?: 'Personal' | 'Education' | 'Home' | 'Vehicle' | 'Business' | 'Other';
  interestRate?: number;
  emi: number;
  startDate: string;
  dueDate: string;
  frequency: 'Monthly' | 'Quarterly' | 'Weekly' | 'Bi-weekly';
  tenureMonths: number | null;
  mobileNumber: string;
  reminderDays: number[];
  notes: string;
  monthlyIncome?: number | null;
  createdAt: string;
  status: 'Active' | 'Closed';
  email?: string;
  emailReminders?: boolean;
  smsReminders?: boolean;
}

export interface NotificationLog {
  id: string;
  loanId: string;
  instalmentNumber: number;
  channel: 'email' | 'sms';
  reminderDays: number;
  scheduledFor: string;
  status: 'Scheduled' | 'Sent' | 'Failed' | 'Not Configured';
  providerResponse: string | null;
  sentAt: string | null;
}

export interface RepaymentRecord {
  id: string;
  loanId: string;
  date: string;
  amount: number;
  instalmentNumber: number;
  actualAmount: number | null;
  paymentDate: string | null;
  status: 'Paid' | 'Scheduled' | 'Overdue' | 'Not Configured';
  reminderStatus: 'Scheduled' | 'Sent' | 'Failed' | 'Not Configured';
  notes: string;
}

export interface TransferMatch {
  id: string;
  debitTxnId: string;
  creditTxnId: string;
  debitTxn: import('./index').Transaction;
  creditTxn: import('./index').Transaction;
  confidence: number;
  reasons: string[];
  status: 'proposed' | 'confirmed' | 'rejected';
}

export interface QRPayload {
  rawPayload: string;
  type: 'upi' | 'url' | 'unknown';
  payeeName: string | null;
  upiId: string | null;
  amount: string | null;
  note: string | null;
  url: string | null;
}

export interface SecurityIndicator {
  label: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detail: string;
  weight: number;
}

export interface SecurityAssessment {
  payload: QRPayload;
  riskScore: number;
  riskCategory: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Critical';
  indicators: SecurityIndicator[];
  advice: string[];
  disclaimer: string;
  analysisType: 'heuristic';
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  transactions?: import('./index').Transaction[];
  calculation?: { label: string; value: string }[];
}

export const LOAN_CATEGORIES: TransactionCategory[] = ['Loan_EMI'];
export const REMINDER_DAYS_OPTIONS = [7, 3, 1, 0];
