import { TransactionCategory, TransactionType } from '@/types';
import type { Transaction } from '@/types';

interface CategoryRule {
  category: TransactionCategory;
  keywords: string[];
  patterns?: RegExp[];
  priority?: number;
}

// Generic merchant indicators — used for P2M detection (not named platforms)
const GENERIC_MERCHANT_INDICATORS = [
  'merchant', 'pos', 'bharatpe', 'phonepe merchant', 'paytm merchant',
  'store', 'shop', 'restaurant', 'cafe', 'pharmacy', 'medical', 'kirana',
  'grocery', 'supermarket', 'bakery', 'tea shop', 'tea stall', 'mall', 'retail',
  'card swipe', 'pos debit', 'pos terminal',
];

// All merchant indicators (generic + named platforms) — used for M2P credit detection
const MERCHANT_INDICATORS = [
  ...GENERIC_MERCHANT_INDICATORS,
  'purchase', 'order', 'delivery', 'swiggy', 'zomato', 'amazon', 'flipkart',
  'myntra', 'bigbasket', 'blinkit', 'zepto', 'instamart', 'dmart',
  'dominos', 'kfc', 'mcdonald', 'pizza hut', 'starbucks',
  'croma', 'reliance digital', 'decathlon', 'nike', 'adidas',
  'hotel', 'tea',
];

const P2P_INDICATORS = [
  'sent to', 'received from', 'sent-', 'received-', 'p2p',
  'person', 'friend', 'family', 'mother', 'father', 'brother', 'sister',
  'wife', 'husband', 'son', 'daughter', 'cousin', 'relative',
  'upi sent to', 'upi received from', 'imps sent to', 'imps received from',
  'neft sent to', 'neft received from', 'sent to mother', 'sent to father',
  'received from friend', 'sent to friend', 'collected from',
];

const INTERNAL_INDICATORS = [
  'internal', 'self transfer', 'self-transfer', 'linked account',
  'sweep in', 'sweep out', 'auto sweep', 'upi to self', 'imps self',
  'neft self', 'transfer to self', 'own account',
];

const CREDIT_CARD_BILL_INDICATORS = [
  'credit card', 'cc autopay', 'cc payment', 'cc bill', 'card autopay',
  'credit card autopay', 'credit card bill', 'credit card payment',
  'ccautopay', 'card bill', 'auto debit cc', 'cc autodebit',
  'hdfc credit card', 'icici credit card', 'sbi credit card', 'axis credit card',
  'citi credit card', 'kotak credit card', 'idfc credit card',
  'amex', 'american express',
];

const SALARY_INCOME_INDICATORS = [
  'salary', 'payroll', 'wages', 'paycheck', 'monthly pay',
  'inc salary', 'accr salary', 'credit salary', 'neft salary',
];

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Salary',
    keywords: SALARY_INCOME_INDICATORS,
    priority: 10,
  },
  {
    category: 'Scholarship',
    keywords: ['scholarship', 'stipend', 'fellowship', 'grant', 'education award', 'merit', 'aicte', 'pragati'],
    priority: 10,
  },
  {
    category: 'Interest',
    keywords: ['interest', 'int paid', 'int recv', 'savings interest', 'fd interest', 'rd interest', 'interest credit', 'int sav'],
    priority: 10,
  },
  {
    category: 'Loan_EMI',
    keywords: ['emi', 'loan', 'hdfc loan', 'icici loan', 'sbi loan', 'axis loan', 'auto loan', 'home loan', 'education loan', 'repayment', 'principal', 'amortization', 'fin serve', 'loan emi', 'emi dr', 'emi deduction'],
    priority: 9,
  },
  {
    category: 'Refund',
    keywords: ['refund', 'cashback', 'rebate', 'reversal', 'failed txn reversal', 'chargeback', 'cancel refund', 'refund processed', 'order cancel'],
    priority: 9,
  },
  {
    category: 'Internal_Transfer',
    keywords: INTERNAL_INDICATORS,
    priority: 8,
  },
  {
    category: 'ATM_Withdrawal',
    keywords: ['atm', 'cash withdrawal', 'cash wdl', 'mini statement', 'cash pull out', 'cash withdrawal'],
    priority: 8,
  },
  {
    category: 'Credit_Card_Payment',
    keywords: CREDIT_CARD_BILL_INDICATORS,
    priority: 8,
  },
  {
    category: 'Education',
    keywords: ['college', 'university', 'tuition', 'semester fee', 'exam fee', 'library', 'course', 'udemy', 'coursera', 'byjus', 'unacademy', 'whitehat', 'school', 'institution', 'academy', 'hostel', 'mess'],
    priority: 7,
  },
  {
    category: 'Travel',
    keywords: ['irctc', 'makemytrip', 'mmt', 'goibibo', 'oyo', 'booking.com', 'agoda', 'hotel booking', 'flight', 'indigo', 'spicejet', 'air india', 'vistara', 'airfare', 'travel', 'oyo room', 'hotel room'],
    priority: 7,
  },
  {
    category: 'Transport',
    keywords: ['uber', 'ola cab', 'rapido', 'redbus', 'abhibus', 'metro', 'bmtc', 'dtc', 'train ticket', 'bus ticket', 'petrol', 'diesel', 'fuel', 'fastag', 'toll', 'parking', 'cab ride'],
    priority: 7,
  },
  {
    category: 'P2M',
    keywords: ['pos debit', 'pos terminal', 'card swipe', 'bharatpe', 'phonepe merchant', 'paytm merchant', 'payment to merchant', 'upi payment to shop', 'upi payment to store', 'upi payment to pharmacy', 'upi payment to restaurant', 'upi payment to tea shop', 'upi payment to kirana', 'upi payment to cafe', 'upi payment to medical', 'upi payment to bakery', 'upi payment to supermarket', 'upi payment to grocery', 'upi payment to mall'],
    priority: 7,
  },
  {
    category: 'Shopping',
    keywords: ['amazon', 'flipkart', 'myntra', 'snapdeal', 'ajio', 'big bazaar', 'reliance', 'dmart', 'lifestyle', 'pantaloons', 'westside', 'shoppers stop', 'croma', 'reliance digital', 'ikea', 'home centre', 'decathlon', 'nike', 'adidas', 'puma', 'fashion', 'electronics purchase'],
    priority: 6,
  },
  {
    category: 'Food',
    keywords: ['swiggy', 'zomato', 'dominos', 'mcdonald', 'kfc', 'pizza hut', 'burger king', 'starbucks', 'cafe', 'restaurant', 'hotel food', 'dineout', 'eatfit', 'foodpanda', 'grofers', 'bigbasket', 'blinkit', 'zepto', 'instamart', 'food', 'beverage', 'bakery'],
    priority: 6,
  },
  {
    category: 'Utilities',
    keywords: ['electricity', 'water bill', 'gas bill', 'broadband', 'internet', 'mobile recharge', 'airtel', 'jio', 'vodafone', 'vi prepaid', 'bsnl', 'tata power', 'adani gas', 'mahanagar', 'bills', 'bbps', 'bescom', 'mseb', 'tneb', 'dth', 'tata sky', 'd2h', 'auto pay bill', 'bill payment'],
    priority: 6,
  },
  {
    category: 'Subscription',
    keywords: ['netflix', 'prime', 'hotstar', 'disney', 'spotify', 'youtube premium', 'google one', 'icloud', 'apple', 'microsoft', 'adobe', 'subscription', 'monthly subscription', 'recurring', 'saas', 'notion', 'github'],
    priority: 5,
  },
];

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

function looksLikeMerchant(text: string, merchant: string | null): boolean {
  if (merchant && merchant.trim().length > 0) {
    const m = normalizeText(merchant);
    if (GENERIC_MERCHANT_INDICATORS.some((ind) => m.includes(ind))) return true;
    if (MERCHANT_INDICATORS.some((ind) => m.includes(ind))) return true;
  }
  return hasAny(text, GENERIC_MERCHANT_INDICATORS) || hasAny(text, MERCHANT_INDICATORS);
}

function looksLikeP2P(text: string): boolean {
  return hasAny(text, P2P_INDICATORS);
}

function looksLikeInternal(text: string): boolean {
  return hasAny(text, INTERNAL_INDICATORS);
}

function looksLikeCreditCardBill(text: string): boolean {
  return hasAny(text, CREDIT_CARD_BILL_INDICATORS);
}

export function categorize(
  description: string,
  type: TransactionType,
  merchant: string | null = null,
  reference: string | null = null,
): TransactionCategory {
  const text = normalizeText(`${description} ${merchant ?? ''} ${reference ?? ''}`);

  if (looksLikeCreditCardBill(text)) {
    return 'Credit_Card_Payment';
  }

  const sortedRules = [...CATEGORY_RULES].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  for (const rule of sortedRules) {
    if (rule.category === 'Credit_Card_Payment') continue;
    for (const kw of rule.keywords) {
      if (text.includes(kw)) return rule.category;
    }
  }

  if (looksLikeInternal(text)) {
    return 'Internal_Transfer';
  }

  if (looksLikeP2P(text)) {
    return 'P2P';
  }

  if (looksLikeMerchant(text, merchant)) {
    return type === 'credit' ? 'M2P' : 'P2M';
  }

  if (type === 'credit') {
    if (text.includes('received') || text.includes('collected') || text.includes('credit')) {
      if (looksLikeMerchant(text, merchant)) return 'M2P';
      return 'Other';
    }
    return 'Other';
  }

  if (text.includes('upi') || text.includes('gpay') || text.includes('phonepe') || text.includes('paytm')) {
    if (looksLikeMerchant(text, merchant)) return 'P2M';
    return 'Other';
  }

  return 'Uncategorized';
}

export function isUncertain(category: TransactionCategory, description: string): boolean {
  if (category === 'Uncategorized' || category === 'Other') return true;
  const d = description.toLowerCase();
  if (category === 'P2P' && d.includes('merchant')) return true;
  if (category === 'P2M' && (d.includes('sent to') || d.includes('received from'))) return true;
  return false;
}

export function detectInternalTransfer(description: string): boolean {
  const d = description.toLowerCase();
  return looksLikeInternal(d);
}

export function isLikelyDuplicate(
  txn: { date: string; amount: number; type: TransactionType; description: string; account: string; reference?: string | null },
  existing: Transaction[],
): boolean {
  const cleanRef = (r: string | null | undefined) => (r && r.trim().length > 0 ? r.trim() : null);

  const txnRef = cleanRef(txn.reference);
  if (txnRef) {
    const refMatch = existing.find((e) => cleanRef(e.reference) === txnRef);
    if (refMatch) return true;
  }

  return existing.some(
    (e) =>
      e.date === txn.date &&
      e.amount === txn.amount &&
      e.type === txn.type &&
      e.account === txn.account &&
      e.description === txn.description,
  );
}
