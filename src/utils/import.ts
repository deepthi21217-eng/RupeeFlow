import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Transaction, TransactionType, ImportResult, UploadedTransaction } from '@/types';
import { categorize } from './categorize';
import { isLikelyDuplicate } from './categorize';
import { uuidSimple } from './uuid';

export interface ParsedRow {
  [key: string]: string;
}

export interface ColumnMapping {
  date: string;
  description: string;
  debit: string;
  credit: string;
  amount: string;
  balance: string;
  reference: string;
  merchant: string;
  account: string;
}

export const MAX_IMPORT_ROWS = 100_000;
export const IMPORT_BATCH_SIZE = 5_000;

const COLUMN_ALIASES: Record<string, string[]> = {
  date: ['date', 'txn date', 'transaction date', 'value date', 'posting date', 'date of transaction', 'dt', 'dated', 'txn_date'],
  description: ['description', 'narration', 'particulars', 'details', 'remarks', 'transaction details', 'txn description', 'memo', 'narration details'],
  debit: ['debit', 'debit amount', 'withdrawal', 'withdrawal amount', 'dr', 'dr amount', 'debited', 'debit (inr)', 'debit_amt'],
  credit: ['credit', 'credit amount', 'deposit', 'deposit amount', 'cr', 'cr amount', 'credited', 'credit (inr)', 'credit_amt'],
  amount: ['amount', 'transaction amount', 'txn amount', 'amt', 'value', 'amount (inr)', 'amount_rs', 'amount inr'],
  balance: ['balance', 'running balance', 'closing balance', 'available balance', 'balance (inr)', 'bal', 'current balance'],
  reference: ['reference', 'ref no', 'reference no', 'reference number', 'cheque no', 'cheque number', 'txn id', 'transaction id', 'rrn', 'utr', 'ref', 'reference_no'],
  merchant: ['merchant', 'merchant name', 'payee', 'beneficiary', 'payee name', 'to/from', 'counterparty'],
  account: ['account', 'account number', 'account no', 'acct no', 'account_id', 'ac no'],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[\s_-]+/g, ' ').replace(/[^a-z0-9 ()]/g, '').trim();
}

export function autoDetectColumns(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const mapping: ColumnMapping = {
    date: '', description: '', debit: '', credit: '', amount: '', balance: '', reference: '', merchant: '', account: '',
  };

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (let i = 0; i < normalized.length; i++) {
      if (aliases.includes(normalized[i])) {
        (mapping as unknown as Record<string, string>)[field] = headers[i];
        break;
      }
    }
  }

  return mapping;
}

export function parseCSVFile(file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          reject(new Error(results.errors[0].message));
          return;
        }
        const headers = results.meta.fields ?? [];
        const rows = results.data.filter((r) => r && Object.keys(r).length > 0);
        resolve({ headers, rows });
      },
      error: (err) => reject(err),
    });
  });
}

export interface ExcelSheetInfo {
  name: string;
  rowCount: number;
  headers: string[];
}

let workbookCache: { file: File; data: ArrayBuffer; wb: XLSX.WorkBook } | null = null;

async function getWorkbook(file: File): Promise<XLSX.WorkBook> {
  if (workbookCache && workbookCache.file === file) {
    return workbookCache.wb;
  }
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array', cellDates: true, dense: true });
  workbookCache = { file, data, wb };
  return wb;
}

export async function getExcelSheetInfos(file: File): Promise<ExcelSheetInfo[]> {
  const wb = await getWorkbook(file);
  const sheets: ExcelSheetInfo[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      sheets.push({ name: sheetName, rowCount: 0, headers: [] });
      continue;
    }
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
    const rowCount = Math.max(0, range.e.r - range.s.r);
    const headers = readHeaderRow(ws, range);
    sheets.push({ name: sheetName, rowCount, headers });
  }

  return sheets;
}

export async function parseExcelSheets(file: File): Promise<{ sheets: ExcelSheetInfo[] }> {
  const sheets = await getExcelSheetInfos(file);
  return { sheets };
}

function getCell(ws: XLSX.WorkSheet, r: number, c: number): XLSX.CellObject | null {
  if (Array.isArray(ws)) {
    const row = ws[r];
    if (!row) return null;
    const cell = row[c];
    return (cell as XLSX.CellObject) ?? null;
  }
  const addr = XLSX.utils.encode_cell({ r, c });
  return (ws[addr] as XLSX.CellObject) ?? null;
}

function readHeaderRow(ws: XLSX.WorkSheet, range: XLSX.Range): string[] {
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = getCell(ws, range.s.r, c);
    headers.push(cell && cell.v != null ? String(cell.v) : `Column${c + 1}`);
  }
  return headers.filter((h) => h.trim().length > 0 || true);
}

export async function parseExcelSheet(file: File, sheetIndex: number): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  const wb = await getWorkbook(file);
  const sheetName = wb.SheetNames[sheetIndex] ?? wb.SheetNames[0];

  if (!sheetName) {
    return { headers: [], rows: [] };
  }

  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) {
    return { headers: [], rows: [] };
  }

  const range = XLSX.utils.decode_range(ws['!ref']);
  const headers = readHeaderRow(ws, range);

  const rows: ParsedRow[] = [];
  const dataStartRow = range.s.r + 1;
  const maxRow = Math.min(range.e.r, range.s.r + MAX_IMPORT_ROWS);

  for (let r = dataStartRow; r <= maxRow; r++) {
    const row: ParsedRow = {};
    let hasData = false;

    for (let c = range.s.c; c <= range.e.c; c++) {
      const headerIdx = c - range.s.c;
      const header = headers[headerIdx];
      if (!header) continue;

      const cell = getCell(ws, r, c);
      if (cell == null) {
        row[header] = '';
        continue;
      }

      let value: string;

      if (cell.t === 'd' && cell.v instanceof Date) {
        value = formatDateCell(cell.v);
      } else if (cell.t === 'n' && typeof cell.v === 'number') {
        if (cell.w && /\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(cell.w)) {
          value = cell.w;
        } else {
          value = String(cell.v);
        }
      } else {
        value = String(cell.v ?? '');
      }

      if (value.trim().length > 0) hasData = true;
      row[header] = value;
    }

    if (hasData) {
      rows.push(row);
    }
  }

  return { headers, rows };
}

function formatDateCell(date: Date): string {
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function detectLikelyTransactionSheets(sheets: ExcelSheetInfo[]): ExcelSheetInfo[] {
  const txKeywords = ['date', 'description', 'narration', 'debit', 'credit', 'amount', 'balance', 'transaction'];
  return sheets
    .filter((s) => s.rowCount > 0)
    .map((s) => {
      const normalizedHeaders = s.headers.map(normalizeHeader);
      const matchCount = normalizedHeaders.filter((h) => txKeywords.some((kw) => h.includes(kw))).length;
      return { sheet: s, score: matchCount };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.sheet);
}

function parseAmount(value: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.-]/g, '').trim();
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseDate(value: string): string | null {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];

  const parts = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (parts) {
    const [, dd, mm, yyRaw] = parts;
    const yy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
    const date = new Date(parseInt(yy), parseInt(mm) - 1, parseInt(dd));
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }

  const ymdParts = value.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdParts) {
    const [, yy, mm, dd] = ymdParts;
    const date = new Date(parseInt(yy), parseInt(mm) - 1, parseInt(dd));
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }

  return null;
}

export function importRows(
  rows: ParsedRow[],
  mapping: ColumnMapping,
  defaultAccount: string,
  existingTransactions: Transaction[],
): ImportResult {
  const errors: string[] = [];
  const transactions: UploadedTransaction[] = [];
  let imported = 0;
  let skipped = 0;
  let duplicates = 0;

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;

    const dateStr = mapping.date ? row[mapping.date] : '';
    const parsedDate = parseDate(dateStr ?? '');
    if (!parsedDate) {
      skipped++;
      errors.push(`Row ${rowNum}: Invalid or missing date "${dateStr}"`);
      return;
    }

    const description = mapping.description ? (row[mapping.description] ?? '').trim() : '';
    if (!description) {
      skipped++;
      errors.push(`Row ${rowNum}: Missing description`);
      return;
    }

    let amount: number | null = null;
    let type: TransactionType = 'debit';

    if (mapping.debit && mapping.credit) {
      const debitAmt = parseAmount(row[mapping.debit] ?? '');
      const creditAmt = parseAmount(row[mapping.credit] ?? '');
      if (debitAmt && debitAmt > 0) {
        amount = debitAmt;
        type = 'debit';
      } else if (creditAmt && creditAmt > 0) {
        amount = creditAmt;
        type = 'credit';
      } else if (debitAmt === 0 && creditAmt === 0) {
        amount = 0;
        type = 'debit';
      }
    } else if (mapping.amount) {
      const amt = parseAmount(row[mapping.amount] ?? '');
      if (amt !== null) {
        amount = Math.abs(amt);
        type = amt >= 0 ? 'credit' : 'debit';
      }
    } else if (mapping.debit) {
      const amt = parseAmount(row[mapping.debit] ?? '');
      if (amt && amt > 0) { amount = amt; type = 'debit'; }
    } else if (mapping.credit) {
      const amt = parseAmount(row[mapping.credit] ?? '');
      if (amt && amt > 0) { amount = amt; type = 'credit'; }
    }

    if (amount === null || amount <= 0) {
      if (amount === 0) {
        skipped++;
        errors.push(`Row ${rowNum}: Zero amount`);
        return;
      }
      skipped++;
      errors.push(`Row ${rowNum}: Invalid amount`);
      return;
    }

    const balance = mapping.balance ? parseAmount(row[mapping.balance] ?? '') : null;
    const reference = mapping.reference ? (row[mapping.reference] ?? '').trim() || null : null;
    const merchant = mapping.merchant ? (row[mapping.merchant] ?? '').trim() || null : null;
    const account = mapping.account ? (row[mapping.account] ?? '').trim() || defaultAccount : defaultAccount;

    const uploaded: UploadedTransaction = {
      date: parsedDate,
      description,
      type,
      amount,
      account,
      balanceAfter: balance,
      reference,
      merchant,
    };

    const isDup = isLikelyDuplicate(
      { date: parsedDate, amount, type, description, account, reference },
      existingTransactions,
    );

    if (isDup) {
      duplicates++;
    }

    transactions.push(uploaded);
    imported++;
  });

  return { imported, skipped, duplicates, errors: errors.slice(0, 50), transactions };
}

export interface BatchImportProgress {
  stage: string;
  processed: number;
  total: number;
  imported: number;
  skipped: number;
  duplicates: number;
  errors: string[];
}

export async function importRowsBatched(
  rows: ParsedRow[],
  mapping: ColumnMapping,
  defaultAccount: string,
  existingTransactions: Transaction[],
  onProgress?: (progress: BatchImportProgress) => void,
): Promise<ImportResult> {
  const total = rows.length;
  const allErrors: string[] = [];
  const allTransactions: UploadedTransaction[] = [];
  let imported = 0;
  let skipped = 0;
  let duplicates = 0;

  const batchSize = IMPORT_BATCH_SIZE;

  for (let start = 0; start < total; start += batchSize) {
    const end = Math.min(start + batchSize, total);
    const batch = rows.slice(start, end);

    const batchResult = importRows(batch, mapping, defaultAccount, existingTransactions);
    imported += batchResult.imported;
    skipped += batchResult.skipped;
    duplicates += batchResult.duplicates;
    allErrors.push(...batchResult.errors);
    allTransactions.push(...batchResult.transactions);

    if (onProgress) {
      onProgress({
        stage: 'Categorizing transactions',
        processed: end,
        total,
        imported,
        skipped,
        duplicates,
        errors: allErrors.slice(0, 50),
      });
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  return {
    imported,
    skipped,
    duplicates,
    errors: allErrors.slice(0, 50),
    transactions: allTransactions,
  };
}

export function uploadedToTransactions(
  uploaded: UploadedTransaction[],
  existingTransactions: Transaction[],
): Transaction[] {
  return uploaded.map((u) => {
    const isDup = isLikelyDuplicate(
      { date: u.date, amount: u.amount, type: u.type, description: u.description, account: u.account, reference: u.reference },
      existingTransactions,
    );
    const isInternal = u.description.toLowerCase().includes('internal') ||
      u.description.toLowerCase().includes('self transfer') ||
      u.description.toLowerCase().includes('linked account');

    return {
      id: uuidSimple(),
      date: u.date,
      description: u.description,
      type: u.type,
      amount: u.amount,
      category: categorize(u.description, u.type, u.merchant, u.reference),
      account: u.account,
      balanceAfter: u.balanceAfter,
      reference: u.reference,
      merchant: u.merchant,
      isDuplicate: isDup,
      isInternalTransfer: isInternal,
      userEdited: false,
    } as Transaction;
  });
}

export async function uploadedToTransactionsBatched(
  uploaded: UploadedTransaction[],
  existingTransactions: Transaction[],
  onProgress?: (processed: number, total: number) => void,
): Promise<Transaction[]> {
  const result: Transaction[] = [];
  const batchSize = IMPORT_BATCH_SIZE;

  for (let start = 0; start < uploaded.length; start += batchSize) {
    const end = Math.min(start + batchSize, uploaded.length);
    const batch = uploaded.slice(start, end);
    const txns = uploadedToTransactions(batch, existingTransactions);
    result.push(...txns);

    if (onProgress) {
      onProgress(end, uploaded.length);
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  return result;
}

export function clearWorkbookCache(): void {
  workbookCache = null;
}

export function generateSampleCSV(): string {
  const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance', 'Reference', 'Merchant'];
  const sampleRows = [
    ['2025-01-05', 'SALARY CREDIT INFOSYS LTD', '', '55000.00', '80000.00', 'REF1001', 'INFOSYS LTD'],
    ['2025-01-06', 'UPI SENT TO PRIYA SHARMA', '2500.00', '', '77500.00', 'UPI002345', ''],
    ['2025-01-08', 'SWIGGY FOOD ORDER DELIVERY', '350.00', '', '77150.00', 'SWGY889', 'SWIGGY'],
    ['2025-01-10', 'AMAZON IN PURCHASE ORDER', '2499.00', '', '74651.00', 'AMZ4567', 'AMAZON'],
    ['2025-01-12', 'COLLEGE TUITION FEE SEM PAYMENT', '35000.00', '', '39651.00', 'VIT2025', 'VIT UNIVERSITY'],
    ['2025-01-15', 'NETFLIX MONTHLY SUBSCRIPTION', '649.00', '', '39002.00', 'NFLX009', 'NETFLIX'],
    ['2025-01-18', 'ATM CASH WITHDRAWAL', '5000.00', '', '34002.00', 'ATM5521', ''],
    ['2025-01-20', 'AICTE SCHOLARSHIP CREDIT', '', '15000.00', '49002.00', 'AICTE334', 'AICTE'],
    ['2025-01-22', 'TATA POWER ELECTRICITY BILL', '1850.00', '', '47152.00', 'TPE0101', 'TATA POWER'],
    ['2025-01-25', 'HDFC EDUCATION LOAN EMI DR', '9000.00', '', '38152.00', 'HDFCLEMI', 'HDFC LOAN'],
  ];
  return [headers.join(','), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
}
