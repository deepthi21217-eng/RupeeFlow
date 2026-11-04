import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: string; positive: boolean };
  variant?: 'default' | 'credit' | 'debit' | 'neutral';
}

export default function StatCard({ title, value, subtitle, icon, trend, variant = 'default' }: StatCardProps) {
  const variantStyles = {
    default: 'text-slate-800',
    credit: 'text-green-600',
    debit: 'text-red-600',
    neutral: 'text-blue-600',
  };

  const iconBg = {
    default: 'bg-blue-50 text-blue-600',
    credit: 'bg-green-50 text-green-600',
    debit: 'bg-red-50 text-red-600',
    neutral: 'bg-blue-50 text-blue-600',
  };

  return (
    <div className="rf-card p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
        {icon && <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg[variant]}`}>{icon}</div>}
      </div>
      <p className={`text-2xl font-bold ${variantStyles[variant]}`}>{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          <span className={`text-xs font-medium ${trend.positive ? 'text-green-600' : 'text-red-500'}`}>
            {trend.positive ? '▲' : '▼'} {trend.value}
          </span>
        </div>
      )}
    </div>
  );
}
