import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, TransactionCategory, CATEGORY_LABELS } from '@/types';
import { formatDate } from './format';

function inr(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

interface CategoryPDFOptions {
  transactions: Transaction[];
  category: TransactionCategory | 'all';
  dateFrom?: string;
  dateTo?: string;
}

function escapeText(s: string): string {
  return s.replace(/[^ -~\u20B9]/g, '').slice(0, 50);
}

export function generateCategoryPDF({ transactions, category, dateFrom, dateTo }: CategoryPDFOptions): jsPDF | null {
  if (transactions.length === 0) return null;

  const filtered = dateFrom || dateTo
    ? transactions.filter((t) => {
        if (dateFrom && t.date < dateFrom) return false;
        if (dateTo && t.date > dateTo) return false;
        return true;
      })
    : transactions;

  if (filtered.length === 0) return null;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const categoryLabel = category === 'all' ? 'All Transactions' : CATEGORY_LABELS[category];
  const title = `${categoryLabel} Report`;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`RupeeFlow — ${title}`, 40, 40);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Generated: ${formatDate(new Date())}`, 40, 55);
  doc.text(`Category: ${categoryLabel}`, 40, 68);

  const dateRange = `${formatDate(filtered.reduce((min, t) => t.date < min ? t.date : min, filtered[0].date))} to ${formatDate(filtered.reduce((max, t) => t.date > max ? t.date : max, filtered[0].date))}`;
  doc.text(`Date Range: ${dateRange}`, 40, 81);

  const totalCredit = filtered.filter((t) => t.type === 'credit').reduce((a, b) => a + b.amount, 0);
  const totalDebit = filtered.filter((t) => t.type === 'debit').reduce((a, b) => a + b.amount, 0);
  const net = totalCredit - totalDebit;

  doc.setTextColor(0);
  autoTable(doc, {
    startY: 98,
    head: [['Total Credit', 'Total Debit', 'Net Cash Flow', 'Transaction Count']],
    body: [[inr(totalCredit), inr(totalDebit), inr(net), String(filtered.length)]],
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 40, right: 40 },
  });

  const afterSummary = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: afterSummary + 20,
    head: [['Date', 'Description', 'Merchant', 'Category', 'Account', 'Debit', 'Credit', 'Balance', 'Ref']],
    body: filtered.map((t) => [
      formatDate(t.date),
      escapeText(t.description),
      escapeText(t.merchant ?? '—'),
      CATEGORY_LABELS[t.category].slice(0, 18),
      t.account.slice(0, 14),
      t.type === 'debit' ? inr(t.amount) : '—',
      t.type === 'credit' ? inr(t.amount) : '—',
      t.balanceAfter !== null ? inr(t.balanceAfter) : '—',
      t.reference ?? '—',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [71, 85, 105], fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const pageNum = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Page ${pageNum}`, pageWidth - 60, pageHeight - 20);
    },
  });

  return doc;
}

export function downloadCategoryPDF(options: CategoryPDFOptions): boolean {
  try {
    const doc = generateCategoryPDF(options);
    if (!doc) return false;
    const catLabel = options.category === 'all' ? 'all' : options.category;
    const today = new Date().toISOString().split('T')[0];
    doc.save(`rupeeflow_${catLabel}_${today}.pdf`);
    return true;
  } catch {
    return false;
  }
}
