import { Transaction } from '@/types';
import { supabase } from '@/lib/supabase';

interface TransactionRow {
  id: string;
  transaction_date: string;
  description: string;
  transaction_type: 'credit' | 'debit';
  amount: number;
  category: Transaction['category'];
  account: string;
  balance_after: number | null;
  reference: string | null;
  merchant: string | null;
  is_duplicate: boolean;
  is_internal_transfer: boolean;
  user_edited: boolean;
}

function mapRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.transaction_date,
    description: row.description,
    type: row.transaction_type,
    amount: Number(row.amount),
    category: row.category,
    account: row.account,
    balanceAfter: row.balance_after === null ? null : Number(row.balance_after),
    reference: row.reference,
    merchant: row.merchant,
    isDuplicate: row.is_duplicate,
    isInternalTransfer: row.is_internal_transfer,
    userEdited: row.user_edited,
  };
}

function toRow(transaction: Transaction): Record<string, unknown> {
  return {
    id: transaction.id,
    transaction_date: transaction.date,
    description: transaction.description,
    transaction_type: transaction.type,
    amount: transaction.amount,
    category: transaction.category,
    account: transaction.account,
    balance_after: transaction.balanceAfter,
    reference: transaction.reference,
    merchant: transaction.merchant,
    is_duplicate: transaction.isDuplicate,
    is_internal_transfer: transaction.isInternalTransfer,
    user_edited: transaction.userEdited,
    updated_at: new Date().toISOString(),
  };
}

export async function loadCloudTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase.from('financial_transactions').select('*').order('transaction_date', { ascending: false });
  if (error) throw error;
  return (data as TransactionRow[]).map(mapRow);
}

export async function saveCloudTransactions(transactions: Transaction[]): Promise<void> {
  if (transactions.length === 0) return;
  const { error } = await supabase.from('financial_transactions').upsert(transactions.map(toRow));
  if (error) throw error;
}

export async function saveCloudTransaction(transaction: Transaction): Promise<void> {
  const { error } = await supabase.from('financial_transactions').upsert(toRow(transaction));
  if (error) throw error;
}

export async function clearCloudTransactions(): Promise<void> {
  const { error } = await supabase.from('financial_transactions').delete().not('id', 'is', null);
  if (error) throw error;
}
