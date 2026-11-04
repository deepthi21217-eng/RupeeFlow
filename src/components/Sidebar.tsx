import { PageId } from '@/types';
import {
  LayoutDashboard, FileSearch, ArrowRightLeft, BarChart3,
  Landmark, ShieldCheck, Bot, FileText, Plane, Settings, Building2,
} from 'lucide-react';

interface SidebarProps {
  current: PageId;
  onNavigate: (page: PageId) => void;
  collapsed: boolean;
}

const NAV_ITEMS: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'statement', label: 'Statement Intelligence', icon: FileSearch },
  { id: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
  { id: 'analytics', label: 'Financial Analytics', icon: BarChart3 },
  { id: 'loans', label: 'Loans & Payments', icon: Landmark },
  { id: 'security', label: 'Security Analysis', icon: ShieldCheck },
  { id: 'assistant', label: 'Financial Assistant', icon: Bot },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'travel', label: 'Travel & Hotel Booking', icon: Plane },
  { id: 'settings', label: 'Profile & Settings', icon: Settings },
];

export default function Sidebar({ current, onNavigate, collapsed }: SidebarProps) {
  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-white border-r border-slate-200 flex flex-col transition-all duration-200 flex-shrink-0`}>
      <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-200 flex-shrink-0">
        <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-sm font-bold text-slate-800 leading-tight">RupeeFlow</h1>
            <p className="text-[10px] text-slate-400 leading-tight">Banking Intelligence</p>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {active && !collapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
            </button>
          );
        })}
      </nav>
      <div className="px-3 py-3 border-t border-slate-200 flex-shrink-0">
        {!collapsed ? (
          <div className="text-[10px] text-slate-400 text-center">
            <p className="font-medium text-slate-500">MCA Final Year Project</p>
            <p className="mt-0.5">Stage 2 · Demo Mode</p>
          </div>
        ) : (
          <div className="text-[10px] text-slate-400 text-center">S2</div>
        )}
      </div>
    </aside>
  );
}
