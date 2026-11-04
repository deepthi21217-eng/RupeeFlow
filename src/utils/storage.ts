import { Transaction } from '@/types';

const STORAGE_KEY = 'rupeeflow_transactions';
const CATEGORY_OVERRIDES_KEY = 'rupeeflow_category_overrides';
let storageScope = 'guest';
export function setStorageScope(scope: string): void { storageScope = scope || 'guest'; }
function scopedKey(key: string): string { return `${key}:${storageScope}`; }

export function loadTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(scopedKey(STORAGE_KEY));
    if (!raw) return [];
    const data = JSON.parse(raw) as Transaction[];
    return data;
  } catch {
    return [];
  }
}

export function saveTransactions(transactions: Transaction[]): void {
  try {
    localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(transactions));
  } catch {
    // storage full or unavailable
  }
}

export function loadCategoryOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(scopedKey(CATEGORY_OVERRIDES_KEY));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveCategoryOverride(transactionId: string, category: string): void {
  try {
    const overrides = loadCategoryOverrides();
    overrides[transactionId] = category;
    localStorage.setItem(scopedKey(CATEGORY_OVERRIDES_KEY), JSON.stringify(overrides));
  } catch {
    // ignore
  }
}

export function clearCategoryOverrides(): void {
  localStorage.removeItem(scopedKey(CATEGORY_OVERRIDES_KEY));
}

export function clearAllData(): void {
  localStorage.removeItem(scopedKey(STORAGE_KEY));
  localStorage.removeItem(scopedKey(CATEGORY_OVERRIDES_KEY));
}

export function hasStoredData(): boolean {
  return localStorage.getItem(scopedKey(STORAGE_KEY)) !== null;
}
