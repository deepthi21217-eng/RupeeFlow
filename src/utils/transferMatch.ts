import { Transaction } from '@/types';
import { TransferMatch } from '@/types/stage2';
import { uuidSimple } from './uuid';

export function findTransferMatches(transactions: Transaction[]): TransferMatch[] {
  const debits = transactions.filter((t) => t.type === 'debit' && !t.isInternalTransfer);
  const credits = transactions.filter((t) => t.type === 'credit' && !t.isInternalTransfer);
  const matches: TransferMatch[] = [];
  const usedCreditIds = new Set<string>();

  for (const debit of debits) {
    let bestMatch: { credit: Transaction; confidence: number; reasons: string[] } | null = null;

    for (const credit of credits) {
      if (usedCreditIds.has(credit.id)) continue;
      if (credit.account === debit.account) continue;

      let confidence = 0;
      const reasons: string[] = [];

      if (debit.amount === credit.amount) {
        confidence += 40;
        reasons.push('Exact amount match');
      } else if (Math.abs(debit.amount - credit.amount) <= 5) {
        confidence += 25;
        reasons.push('Amount match within rounding (±₹5)');
      } else {
        continue;
      }

      const debitDate = new Date(debit.date);
      const creditDate = new Date(credit.date);
      const dayDiff = Math.abs(debitDate.getTime() - creditDate.getTime()) / (1000 * 60 * 60 * 24);

      if (dayDiff === 0) {
        confidence += 30;
        reasons.push('Same date');
      } else if (dayDiff <= 1) {
        confidence += 20;
        reasons.push('Within 1 day');
      } else if (dayDiff <= 3) {
        confidence += 10;
        reasons.push('Within 3 days');
      } else {
        continue;
      }

      const dDesc = debit.description.toLowerCase();
      const cDesc = credit.description.toLowerCase();

      if (debit.reference && credit.reference && debit.reference === credit.reference) {
        confidence += 25;
        reasons.push('Same reference number');
      }

      if (dDesc.includes('transfer') && cDesc.includes('transfer')) {
        confidence += 15;
        reasons.push('Both descriptions mention "transfer"');
      }

      if (dDesc.includes('self') || cDesc.includes('self')) {
        confidence += 15;
        reasons.push('Description mentions "self"');
      }

      if (dDesc.includes('internal') || cDesc.includes('internal')) {
        confidence += 15;
        reasons.push('Description mentions "internal"');
      }

      if (confidence >= 60 && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { credit, confidence, reasons };
      }
    }

    if (bestMatch) {
      usedCreditIds.add(bestMatch.credit.id);
      matches.push({
        id: uuidSimple(),
        debitTxnId: debit.id,
        creditTxnId: bestMatch.credit.id,
        debitTxn: debit,
        creditTxn: bestMatch.credit,
        confidence: Math.min(100, bestMatch.confidence),
        reasons: bestMatch.reasons,
        status: 'proposed',
      });
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

export function getConfirmedTransferIds(matches: TransferMatch[]): Set<string> {
  const ids = new Set<string>();
  for (const m of matches) {
    if (m.status === 'confirmed') {
      ids.add(m.debitTxnId);
      ids.add(m.creditTxnId);
    }
  }
  return ids;
}
