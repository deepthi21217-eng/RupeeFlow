import { Loan, RepaymentRecord } from '@/types/stage2';

export interface AmortizationRow {
  instalment: number;
  emi: number;
  interest: number;
  principal: number;
  balance: number;
}

export interface EmiResult {
  monthlyEmi: number;
  totalInterest: number;
  totalRepayment: number;
  principal: number;
  schedule: AmortizationRow[];
}

export function calculateEmi(principal: number, annualRate: number, tenureMonths: number): EmiResult {
  const p = Math.max(0, principal);
  const n = Math.max(1, Math.round(tenureMonths));
  const r = annualRate > 0 ? annualRate / 12 / 100 : 0;
  const emi = r > 0
    ? (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    : p / n;
  const totalRepayment = emi * n;
  const totalInterest = totalRepayment - p;
  const schedule: AmortizationRow[] = [];
  let balance = p;
  for (let i = 1; i <= n; i++) {
    const interest = balance * r;
    const principalPart = emi - interest;
    balance = Math.max(0, balance - principalPart);
    schedule.push({ instalment: i, emi, interest, principal: principalPart, balance });
  }
  return { monthlyEmi: emi, totalInterest, totalRepayment, principal: p, schedule };
}

export interface LoanPortfolioStats {
  totalLoans: number;
  totalPrincipal: number;
  totalOutstanding: number;
  totalMonthlyEmi: number;
  totalInterestPayable: number;
  totalRepaid: number;
  completionPercent: number;
  activeLoans: number;
  closedLoans: number;
}

export function computePortfolioStats(loans: Loan[], schedules: Record<string, RepaymentRecord[]>): LoanPortfolioStats {
  let totalPrincipal = 0;
  let totalOutstanding = 0;
  let totalMonthlyEmi = 0;
  let totalInterestPayable = 0;
  let totalRepaid = 0;
  let totalScheduled = 0;
  let activeLoans = 0;
  let closedLoans = 0;
  for (const loan of loans) {
    const schedule = schedules[loan.id] ?? [];
    const paidRecords = schedule.filter((r) => r.status === 'Paid');
    const paidAmount = paidRecords.reduce((sum, r) => sum + (r.actualAmount ?? r.amount), 0);
    totalRepaid += paidAmount;
    totalScheduled += schedule.reduce((sum, r) => sum + r.amount, 0);
    totalPrincipal += loan.amount;
    totalMonthlyEmi += loan.status === 'Active' ? loan.emi : 0;
    if (loan.interestRate && loan.interestRate > 0 && loan.tenureMonths) {
      const result = calculateEmi(loan.amount, loan.interestRate, loan.tenureMonths);
      totalInterestPayable += result.totalInterest;
      const paidCount = paidRecords.length;
      const remainingBalance = paidCount === 0 ? loan.amount : result.schedule[Math.min(paidCount - 1, result.schedule.length - 1)]?.balance ?? loan.amount;
      totalOutstanding += loan.status === 'Active' ? remainingBalance : 0;
    } else {
      totalOutstanding += loan.status === 'Active' ? Math.max(0, loan.amount - paidAmount) : 0;
    }
    if (loan.status === 'Active') activeLoans++; else closedLoans++;
  }
  return {
    totalLoans: loans.length,
    totalPrincipal,
    totalOutstanding,
    totalMonthlyEmi,
    totalInterestPayable,
    totalRepaid,
    completionPercent: totalScheduled > 0 ? Math.round((totalRepaid / totalScheduled) * 100) : 0,
    activeLoans,
    closedLoans,
  };
}

export interface HealthAssessment {
  debtToIncome: number;
  rating: 'Healthy' | 'Moderate' | 'High repayment burden';
  insight: string;
  available: boolean;
}

export function assessLoanHealth(loans: Loan[], monthlyIncome: number | null | undefined): HealthAssessment {
  if (!monthlyIncome || monthlyIncome <= 0) {
    return { debtToIncome: 0, rating: 'Healthy', insight: 'Add a monthly income to your profile to see your debt-to-income ratio.', available: false };
  }
  const totalEmi = loans.filter((l) => l.status === 'Active').reduce((sum, l) => sum + l.emi, 0);
  const ratio = (totalEmi / monthlyIncome) * 100;
  if (ratio < 30) {
    return { debtToIncome: ratio, rating: 'Healthy', insight: `Your EMI commitments use ${ratio.toFixed(1)}% of your income, which is within a comfortable range.`, available: true };
  }
  if (ratio <= 50) {
    return { debtToIncome: ratio, rating: 'Moderate', insight: `Your EMI commitments use ${ratio.toFixed(1)}% of your income. Consider prepaying loans to reduce the burden.`, available: true };
  }
  return { debtToIncome: ratio, rating: 'High repayment burden', insight: `Your EMI commitments use ${ratio.toFixed(1)}% of your income, which is high. Consider restructuring or consolidating loans.`, available: true };
}
