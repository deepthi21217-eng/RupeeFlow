import { PageId, CATEGORY_LABELS } from '@/types';
import { Construction, Sparkles } from 'lucide-react';

interface Stage2PlaceholderProps {
  title: string;
  pageId: PageId;
  description?: string;
}

const MODULE_INFO: Partial<Record<PageId, { features: string[] }>> = {
  loans: {
    features: [
      'EMI tracker with amortization schedule',
      'Loan eligibility calculator',
      'Payment scheduling and reminders',
      'Interest rate comparison across accounts',
    ],
  },
  security: {
    features: [
      'Fraud pattern detection on transaction history',
      'Duplicate and anomaly alerts',
      'Unusual transaction flagging (amount spikes, odd hours)',
      'Security score based on spending patterns',
    ],
  },
  assistant: {
    features: [
      'Natural language query interface for your finances',
      'AI-powered spending insights and recommendations',
      'Budget suggestions based on historical data',
      'Savings goal tracking and projections',
    ],
  },
  travel: {
    features: [
      'Travel expense analysis from transactions',
      'Hotel and flight booking integration',
      'Travel budget planner',
      'Trip-wise expense categorization',
    ],
  },
  settings: {
    features: [
      'Profile management',
      'Category rules customization',
      'Data import/export preferences',
      'Notification and alert settings',
    ],
  },
};

export default function Stage2Placeholder({ title, pageId, description }: Stage2PlaceholderProps) {
  const info = MODULE_INFO[pageId];
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Construction className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">{title}</h2>
        <p className="text-sm text-slate-500 mb-1">
          {description ?? 'This is a Stage 2 module — planned but not yet implemented.'}
        </p>
        <span className="inline-flex items-center gap-1.5 rf-badge bg-amber-50 text-amber-600 mt-2">
          <Sparkles className="w-3.5 h-3.5" /> Stage 2 Module
        </span>

        {info && (
          <div className="mt-8 text-left rf-card p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Planned Features</p>
            <ul className="space-y-2">
              {info.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 text-xs text-slate-400">
          <p>Current Stage 1 modules: Dashboard, Statement Intelligence, Transactions, Financial Analytics, Reports</p>
          <p className="mt-1">Full category coverage: {Object.keys(CATEGORY_LABELS).length} categories implemented</p>
        </div>
      </div>
    </div>
  );
}
