import { Loan, RepaymentRecord } from '@/types/stage2';
import { formatINR } from '@/utils/format';

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportLoanSummary(loans: Loan[], repayments: RepaymentRecord[]): void {
  const rows = [['Loan', 'Lender', 'Category', 'Principal', 'Interest Rate', 'EMI', 'Status', 'Paid Amount', 'Payment Count']];
  for (const loan of loans) {
    const paid = repayments.filter((r) => r.loanId === loan.id && r.status === 'Paid');
    rows.push([loan.name, loan.lender, loan.category ?? 'Personal', formatINR(loan.amount), `${loan.interestRate ?? 0}%`, formatINR(loan.emi), loan.status, formatINR(paid.reduce((sum, r) => sum + (r.actualAmount ?? r.amount), 0)), String(paid.length)]);
  }
  downloadCsv(`rupeeflow-loan-summary-${new Date().toISOString().split('T')[0]}.csv`, rows);
}

export function exportRepaymentHistory(repayments: RepaymentRecord[], loans: Loan[]): void {
  const rows = [['Loan', 'Instalment', 'Due Date', 'EMI', 'Status', 'Payment Date', 'Actual Paid']];
  for (const repayment of repayments) {
    const loan = loans.find((item) => item.id === repayment.loanId);
    rows.push([loan?.name ?? 'Unknown', String(repayment.instalmentNumber), repayment.date, formatINR(repayment.amount), repayment.status, repayment.paymentDate ?? '', repayment.actualAmount === null ? '' : formatINR(repayment.actualAmount)]);
  }
  downloadCsv(`rupeeflow-repayment-history-${new Date().toISOString().split('T')[0]}.csv`, rows);
}
