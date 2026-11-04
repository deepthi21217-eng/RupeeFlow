import { useState, useCallback, useEffect } from 'react';
import { Transaction, ImportResult, UploadedTransaction } from '@/types';
import PageHeader from '@/components/PageHeader';
import { FileSearch, Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, XCircle, FileDown, Trash2, FileCheck2, BarChart3, Tag, Search } from 'lucide-react';
import {
  parseCSVFile, parseExcelSheets, parseExcelSheet, detectLikelyTransactionSheets,
  autoDetectColumns, importRows as importRowsSync,
  importRowsBatched as importRowsBatchedUtil,
  uploadedToTransactionsBatched,
  generateSampleCSV, ColumnMapping, ParsedRow,
  ExcelSheetInfo, MAX_IMPORT_ROWS, clearWorkbookCache,
} from '@/utils/import';
import { downloadCSV } from '@/utils/csv';

interface StatementPageProps {
  existingTransactions: Transaction[];
  onImport: (txns: Transaction[]) => void;
  onClearAll: () => void;
  onNavigate?: (page: 'dashboard') => void;
  onUploadComplete?: (details: { fileName: string; fileType: 'csv' | 'excel'; fileSizeBytes: number; importedCount: number; skippedCount: number; duplicateCount: number }) => void;
}

type ImportStage = 'idle' | 'parsing' | 'parsed' | 'importing' | 'done';
type ProgressStage = 'validating' | 'reading-workbook' | 'identifying-sheet' | 'parsing-rows' | 'categorizing' | 'saving' | 'complete';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface ImportProgress {
  stage: ProgressStage;
  label: string;
  processed: number;
  total: number;
  imported: number;
  skipped: number;
  duplicates: number;
}

export default function StatementPage({ existingTransactions, onImport, onClearAll, onNavigate, onUploadComplete }: StatementPageProps) {
  const [stage, setStage] = useState<ImportStage>('idle');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'csv' | 'excel'>('csv');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [defaultAccount, setDefaultAccount] = useState('XXXXXX0000');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewTxns, setPreviewTxns] = useState<UploadedTransaction[]>([]);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [fileTooLarge, setFileTooLarge] = useState(false);

  const [excelSheets, setExcelSheets] = useState<ExcelSheetInfo[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const loadSheet = useCallback(async (file: File, sheetIndex: number) => {
    setStage('parsing');
    setProgress({ stage: 'parsing-rows', label: 'Parsing rows from sheet...', processed: 0, total: 0, imported: 0, skipped: 0, duplicates: 0 });
    try {
      const parsed = await parseExcelSheet(file, sheetIndex);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError('The selected sheet appears to be empty or has no valid rows.');
        setStage('idle');
        setProgress(null);
        return;
      }
      const autoMapping = autoDetectColumns(parsed.headers);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoMapping);
      setStage('parsed');
      setProgress(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load sheet';
      if (msg.includes('password') || msg.includes('encrypted') || msg.includes('protected')) {
        setError('This Excel file appears to be password-protected and cannot be read.');
      } else {
        setError(msg);
      }
      setStage('idle');
      setProgress(null);
    }
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    setFileName(file.name);
    setCurrentFile(file);
    setFileTooLarge(false);
    setProgress(null);

    if (file.size > MAX_FILE_SIZE) {
      setFileTooLarge(true);
      setError(`File size is ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum supported size is ${MAX_FILE_SIZE / 1024 / 1024} MB. For larger files, split the statement into smaller files.`);
      setStage('idle');
      return;
    }

    const isExcel = file.name.match(/\.(xlsx|xls)$/i);
    setFileType(isExcel ? 'excel' : 'csv');
    setStage('parsing');

    try {
      if (isExcel) {
        setProgress({ stage: 'reading-workbook', label: 'Reading Excel workbook...', processed: 0, total: 0, imported: 0, skipped: 0, duplicates: 0 });
        const { sheets } = await parseExcelSheets(file);
        setProgress({ stage: 'identifying-sheet', label: 'Identifying transaction sheet...', processed: 0, total: sheets.length, imported: 0, skipped: 0, duplicates: 0 });
        setExcelSheets(sheets);
        const likelySheets = detectLikelyTransactionSheets(sheets);
        if (likelySheets.length === 0 && sheets.filter((s) => s.rowCount > 0).length === 0) {
          setError('The Excel file appears to be empty or has no valid rows in any sheet.');
          setStage('idle');
          setProgress(null);
          return;
        }
        const bestSheet = likelySheets[0] ?? sheets.find((s) => s.rowCount > 0);
        if (bestSheet) {
          const sheetIdx = sheets.findIndex((s) => s.name === bestSheet.name);
          setActiveSheetIndex(sheetIdx);
          await loadSheet(file, sheetIdx);
        } else {
          setError('No sheets with data were found in this Excel file.');
          setStage('idle');
          setProgress(null);
        }
      } else {
        setProgress({ stage: 'parsing-rows', label: 'Parsing CSV file...', processed: 0, total: 0, imported: 0, skipped: 0, duplicates: 0 });
        const parsed = await parseCSVFile(file);
        if (parsed.headers.length === 0 || parsed.rows.length === 0) {
          setError('The file appears to be empty or has no valid rows.');
          setStage('idle');
          setProgress(null);
          return;
        }
        if (parsed.rows.length > MAX_IMPORT_ROWS) {
          setError(`CSV file has ${parsed.rows.length.toLocaleString()} rows. Maximum supported is ${MAX_IMPORT_ROWS.toLocaleString()} rows. Please split the file.`);
          setStage('idle');
          setProgress(null);
          return;
        }
        const autoMapping = autoDetectColumns(parsed.headers);
        setHeaders(parsed.headers);
        setRows(parsed.rows);
        setMapping(autoMapping);
        setStage('parsed');
        setProgress(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse file';
      if (msg.includes('password') || msg.includes('encrypted') || msg.includes('protected')) {
        setError('This Excel file appears to be password-protected and cannot be read.');
      } else {
        setError(msg);
      }
      setStage('idle');
      setProgress(null);
    }
  }, [loadSheet]);

  function handlePreview() {
    if (!mapping) return;
    const importResult = importRowsSync(rows.slice(0, 10), mapping, defaultAccount, existingTransactions);
    setPreviewTxns(importResult.transactions);
  }

  async function handleConfirmImport() {
    if (!mapping) return;
    setStage('importing');
    setError(null);

    try {
      setProgress({ stage: 'categorizing', label: 'Categorizing transactions...', processed: 0, total: rows.length, imported: 0, skipped: 0, duplicates: 0 });

      const importResult = await importRowsBatchedUtil(
        rows,
        mapping,
        defaultAccount,
        existingTransactions,
        (p) => {
          setProgress({
            stage: 'categorizing',
            label: `Categorizing transactions... ${p.processed.toLocaleString()} / ${p.total.toLocaleString()} rows`,
            processed: p.processed,
            total: p.total,
            imported: p.imported,
            skipped: p.skipped,
            duplicates: p.duplicates,
          });
        },
      );

      setProgress({ stage: 'saving', label: `Saving ${importResult.imported.toLocaleString()} transactions...`, processed: 0, total: importResult.transactions.length, imported: importResult.imported, skipped: importResult.skipped, duplicates: importResult.duplicates });

      const newTxns = await uploadedToTransactionsBatched(
        importResult.transactions,
        existingTransactions,
        (processed, total) => {
          setProgress({
            stage: 'saving',
            label: `Saving transactions... ${processed.toLocaleString()} / ${total.toLocaleString()}`,
            processed,
            total,
            imported: importResult.imported,
            skipped: importResult.skipped,
            duplicates: importResult.duplicates,
          });
        },
      );

      setResult(importResult);
      onImport(newTxns);
      onUploadComplete?.({ fileName, fileType, fileSizeBytes: currentFile?.size ?? 0, importedCount: importResult.imported, skippedCount: importResult.skipped, duplicateCount: importResult.duplicates });
      setProgress({ stage: 'complete', label: 'Import complete', processed: rows.length, total: rows.length, imported: importResult.imported, skipped: importResult.skipped, duplicates: importResult.duplicates });
      setStage('done');
      clearWorkbookCache();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed unexpectedly';
      setError(`Import failed: ${msg}. You can retry by clicking "Import" again.`);
      setStage('parsed');
      setProgress(null);
    }
  }

  useEffect(() => {
    if (stage !== 'done' || !result || result.imported === 0) return;
    const timer = setTimeout(() => {
      onNavigate?.('dashboard');
    }, 2500);
    return () => clearTimeout(timer);
  }, [stage, result, onNavigate]);

  function handleDownloadSample() {
    downloadCSV(generateSampleCSV(), 'rupeeflow_sample_template.csv');
  }

  function reset() {
    setStage('idle');
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping(null);
    setResult(null);
    setError(null);
    setPreviewTxns([]);
    setExcelSheets([]);
    setActiveSheetIndex(0);
    setCurrentFile(null);
    setProgress(null);
    setFileTooLarge(false);
    clearWorkbookCache();
  }

  const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
    { key: 'date', label: 'Date', required: true },
    { key: 'description', label: 'Description', required: true },
    { key: 'debit', label: 'Debit Amount' },
    { key: 'credit', label: 'Credit Amount' },
    { key: 'amount', label: 'Amount (single column)' },
    { key: 'balance', label: 'Balance After' },
    { key: 'reference', label: 'Reference No' },
    { key: 'merchant', label: 'Merchant' },
    { key: 'account', label: 'Account Number' },
  ];

  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <div>
      <PageHeader
        title="Statement Intelligence"
        subtitle="Upload bank statements for automatic categorization and analysis"
        icon={<FileSearch className="w-5 h-5" />}
        actions={
          <button onClick={handleDownloadSample} className="rf-btn-secondary">
            <FileDown className="w-4 h-4" /> Sample CSV Template
          </button>
        }
      />

      {/* Upload Section */}
      <div className="rf-card p-5 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Upload className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-800">Upload Bank Statement</h3>
            <p className="text-xs text-slate-400">CSV or Excel (.xlsx) bank statement files · Max 50 MB · {MAX_IMPORT_ROWS.toLocaleString()} rows</p>
          </div>
          <button onClick={handleDownloadSample} className="rf-btn-secondary text-xs">
            <FileDown className="w-3.5 h-3.5" /> Sample Template
          </button>
        </div>
        <div className="flex gap-2">
          <label className="rf-btn-primary cursor-pointer flex-1 justify-center">
            <Upload className="w-4 h-4" /> Choose File
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
          </label>
          {existingTransactions.length > 0 && (
            <button
              onClick={() => { if (confirm('Clear all transactions? This cannot be undone.')) { onClearAll(); reset(); } }}
              className="rf-btn-secondary text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" /> Clear All Data
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rf-card p-4 mb-6 border-red-200 bg-red-50">
          <div className="flex items-start gap-2 text-red-600">
            <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">{error}</p>
              {fileTooLarge && (
                <p className="text-xs text-red-500 mt-1">Tip: Export your statement in smaller date ranges (e.g., 3 months at a time) and upload each file separately. RupeeFlow combines multiple uploads into one analysis.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Result */}
      {result && stage === 'done' && (
        <div className="rf-card p-5 mb-6 space-y-3">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-5 h-5" />
            <h3 className="text-sm font-semibold">Import Complete</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{result.imported.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Imported</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{result.skipped.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Skipped</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{result.duplicates.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Duplicates</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-700 mb-1">Validation Issues ({result.errors.length} rows):</p>
              <ul className="text-xs text-amber-600 space-y-0.5 max-h-32 overflow-y-auto">
                {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                {result.errors.length > 10 && <li>...and {result.errors.length - 10} more</li>}
              </ul>
            </div>
          )}
          <button onClick={reset} className="rf-btn-secondary">Import Another File</button>
          {result.imported > 0 && onNavigate && (
            <div className="flex items-center justify-center gap-2 text-xs text-blue-600 bg-blue-50 rounded-lg py-2">
              <div className="w-3 h-3 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              Redirecting to Dashboard...
            </div>
          )}
        </div>
      )}

      {/* Column Mapping */}
      {stage === 'parsed' && mapping && (
        <div className="rf-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Column Mapping</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                <span className="inline-flex items-center gap-1">
                  {fileType === 'excel' ? <FileSpreadsheet className="w-3.5 h-3.5" /> : <FileSearch className="w-3.5 h-3.5" />}
                  {fileName}
                </span>
                <span className="mx-2">·</span>
                {rows.length.toLocaleString()} rows detected · {headers.length} columns
              </p>
            </div>
            <button onClick={reset} className="rf-btn-ghost text-xs">Cancel</button>
          </div>
          {excelSheets.length > 1 && currentFile && (
            <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span className="text-slate-600">Sheet:</span>
              <select
                value={activeSheetIndex}
                onChange={async (e) => {
                  const idx = parseInt(e.target.value);
                  setActiveSheetIndex(idx);
                  try {
                    await loadSheet(currentFile, idx);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to load sheet');
                  }
                }}
                className="rf-select text-xs py-1"
              >
                {excelSheets.map((s, i) => (
                  <option key={s.name} value={i}>{s.name} ({s.rowCount.toLocaleString()} rows)</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MAPPING_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={(mapping as unknown as Record<string, string>)[field.key]}
                  onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                  className="rf-select"
                >
                  <option value="">— Not mapped —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Default Account Number</label>
              <input
                type="text"
                value={defaultAccount}
                onChange={(e) => setDefaultAccount(e.target.value)}
                placeholder="XXXXXX0000"
                className="rf-input"
              />
            </div>
          </div>

          {/* Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Preview (first 10 rows)</h4>
              <button onClick={handlePreview} className="rf-btn-ghost text-xs">Generate Preview</button>
            </div>
            {previewTxns.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-500">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Account</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewTxns.map((t, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-600">{t.date}</td>
                        <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{t.description}</td>
                        <td className="px-3 py-2">
                          <span className={t.type === 'credit' ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                            {t.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-700">
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(t.amount)}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{t.account}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-4">
                Click "Generate Preview" to verify your column mapping before importing.
              </p>
            )}
          </div>

          {/* Validation warnings */}
          {!mapping.date && (
            <div className="flex items-center gap-2 text-amber-600 text-xs">
              <AlertTriangle className="w-4 h-4" /> Date column is required for import.
            </div>
          )}
          {!mapping.description && (
            <div className="flex items-center gap-2 text-amber-600 text-xs">
              <AlertTriangle className="w-4 h-4" /> Description column is required for import.
            </div>
          )}
          {!mapping.debit && !mapping.credit && !mapping.amount && (
            <div className="flex items-center gap-2 text-amber-600 text-xs">
              <AlertTriangle className="w-4 h-4" /> At least one amount column (Debit, Credit, or Amount) must be mapped.
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={reset} className="rf-btn-secondary">Cancel</button>
            <button
              onClick={handleConfirmImport}
              disabled={!mapping.date || !mapping.description || (!mapping.debit && !mapping.credit && !mapping.amount)}
              className="rf-btn-primary"
            >
              <Download className="w-4 h-4" /> Import {rows.length.toLocaleString()} Rows
            </button>
          </div>
        </div>
      )}

      {/* Progress / Importing */}
      {(stage === 'importing' || stage === 'parsing') && progress && (
        <div className="rf-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700">{progress.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Imported: {progress.imported.toLocaleString()} · Skipped: {progress.skipped.toLocaleString()} · Duplicates: {progress.duplicates.toLocaleString()}
              </p>
            </div>
          </div>
          {progress.total > 0 && (
            <div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                <span>{progress.processed.toLocaleString()} / {progress.total.toLocaleString()}</span>
                <span>{progressPercent}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fallback importing spinner if stage is importing but no progress (shouldn't happen) */}
      {stage === 'importing' && !progress && (
        <div className="rf-card p-8 text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Importing transactions...</p>
        </div>
      )}

      {stage === 'idle' && !error && (
        <div className="rf-card p-8 text-center">
          {existingTransactions.length > 0 ? (
            <>
              <FileCheck2 className="w-12 h-12 text-blue-300 mx-auto mb-4" />
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Ready for Your Next Statement</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                You currently have <span className="font-medium text-slate-600">{existingTransactions.length.toLocaleString()}</span> transactions loaded.
                Upload another statement to add more — transactions are automatically combined.
              </p>
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                <div className="bg-slate-50 rounded-lg p-3">
                  <FileCheck2 className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">Auto-detects columns</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <Tag className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">Auto-categorizes</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <BarChart3 className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">Validates data</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <FileSearch className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-sm font-semibold text-slate-600 mb-1">No Data Loaded</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Upload a CSV or Excel bank statement to begin analysis. The system automatically detects columns,
                categorizes transactions, validates data, and generates insights — all from your real statement data.
                Supported formats include exports from HDFC, SBI, ICICI, Axis, and other major Indian banks.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {['Date', 'Description', 'Debit/Credit', 'Amount', 'Balance', 'Reference', 'Merchant'].map((f) => (
                  <span key={f} className="rf-badge bg-slate-100 text-slate-500">{f}</span>
                ))}
              </div>
              <div className="mt-4 text-xs text-slate-400">
                Supports up to {MAX_IMPORT_ROWS.toLocaleString()} rows and 50 MB files. Multiple uploads are combined automatically.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
