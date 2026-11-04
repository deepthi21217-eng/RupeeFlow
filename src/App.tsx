import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { PageId, Transaction, TransactionCategory } from '@/types';
import { Profile } from '@/types/auth';
import Sidebar from '@/components/Sidebar';
import { loadTransactions, saveTransactions, saveCategoryOverride, clearAllData, setStorageScope, hasStoredData } from '@/utils/storage';
import { clearStage2Data, setStage2StorageScope } from '@/utils/storage2';
import { loadCloudTransactions, saveCloudTransactions, saveCloudTransaction, clearCloudTransactions } from '@/utils/cloudTransactions';
import { recordStatementUpload } from '@/utils/cloudUploads';
import { Menu, X, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AuthPage from '@/pages/AuthPage';
import AdminPage from '@/pages/AdminPage';
import NotificationBell from '@/components/NotificationBell';
import { NotificationProvider } from '@/context/notificationContext';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const StatementPage = lazy(() => import('@/pages/StatementPage'));
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const LoansPage = lazy(() => import('@/pages/LoansPage'));
const SecurityPage = lazy(() => import('@/pages/SecurityPage'));
const AssistantPage = lazy(() => import('@/pages/AssistantPage'));
const TravelPage = lazy(() => import('@/pages/TravelPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'admin'>('login');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const { data: nextProfile } = await supabase.from('profiles').select('id, full_name, role, is_active, created_at').eq('id', data.session.user.id).maybeSingle();
        if (mounted && nextProfile?.is_active) setProfile(nextProfile as Profile);
        else if (mounted) await supabase.auth.signOut();
      }
    }).catch(() => {
      if (mounted) setProfile(null);
    }).finally(() => {
      if (mounted) setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      void (async () => {
        if (!session) { if (mounted) setProfile(null); return; }
        const { data: nextProfile } = await supabase.from('profiles').select('id, full_name, role, is_active, created_at').eq('id', session.user.id).maybeSingle();
        if (mounted && nextProfile?.is_active) setProfile(nextProfile as Profile);
      })();
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!profile) return;
    setStorageScope(profile.id);
    setStage2StorageScope(profile.id);
    setLoaded(false);
    void loadCloudTransactions().then((cloudTransactions) => {
      const localTransactions = loadTransactions();
      if (cloudTransactions.length > 0 || !hasStoredData()) {
        setTransactions(cloudTransactions);
        saveTransactions(cloudTransactions);
      } else {
        setTransactions(localTransactions);
        void saveCloudTransactions(localTransactions.filter((transaction) => /^[0-9a-f-]{36}$/i.test(transaction.id))).catch(() => undefined);
      }
    }).catch(() => {
      setTransactions(loadTransactions());
    }).finally(() => setLoaded(true));
  }, [profile]);

  const persistTransactions = useCallback((txns: Transaction[]) => {
    setTransactions(txns);
    saveTransactions(txns);
    void saveCloudTransactions(txns).catch(() => undefined);
  }, []);

  const handleImport = useCallback((newTxns: Transaction[]) => {
    const existing = loadTransactions();
    const combined = [...existing, ...newTxns];
    persistTransactions(combined);
  }, [persistTransactions]);

  const handleClearAll = useCallback(() => {
    clearAllData();
    clearStage2Data();
    setTransactions([]);
    void clearCloudTransactions().catch(() => undefined);
  }, []);

  const handleCategoryChange = useCallback((id: string, category: TransactionCategory) => {
    setTransactions((prev) => {
      const updated = prev.map((t) =>
        t.id === id ? { ...t, category, userEdited: true } : t,
      );
      saveTransactions(updated);
      saveCategoryOverride(id, category);
      const changed = updated.find((transaction) => transaction.id === id);
      if (changed) void saveCloudTransaction(changed).catch(() => undefined);
      return updated;
    });
  }, []);

  const handleNavigate = (page: PageId) => {
    setCurrentPage(page);
    setMobileSidebarOpen(false);
  };

  function renderPage() {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage transactions={transactions} />;
      case 'statement':
        return (
          <StatementPage
            existingTransactions={transactions}
            onImport={handleImport}
            onClearAll={handleClearAll}
            onNavigate={(page) => handleNavigate(page)}
            onUploadComplete={(details) => { void recordStatementUpload(details).catch(() => undefined); }}
          />
        );
      case 'transactions':
        return <TransactionsPage transactions={transactions} onCategoryChange={handleCategoryChange} />;
      case 'analytics':
        return <AnalyticsPage transactions={transactions} />;
      case 'reports':
        return <ReportsPage transactions={transactions} />;
      case 'loans':
        return <LoansPage />;
      case 'security':
        return <SecurityPage />;
      case 'assistant':
        return <AssistantPage transactions={transactions} />;
      case 'travel':
        return <TravelPage transactions={transactions} />;
      case 'settings':
        return <SettingsPage transactions={transactions} onClearAll={handleClearAll} />;
      default:
        return <DashboardPage transactions={transactions} />;
    }
  }

  if (authLoading || (profile !== null && !loaded)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return <AuthPage mode={authMode} onModeChange={setAuthMode} onSuccess={() => setAuthMode('login')} />;
  }

  if (profile.role === 'admin') {
    return <AdminPage onExit={() => setProfile(null)} />;
  }

  return (
    <NotificationProvider>
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="hidden md:flex">
        <Sidebar current={currentPage} onNavigate={handleNavigate} collapsed={sidebarCollapsed} />
      </div>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0">
            <Sidebar current={currentPage} onNavigate={handleNavigate} collapsed={false} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100">
              {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="text-sm font-bold text-slate-800">RupeeFlow</span>
          </div>
          <div className="flex items-center gap-3"><span className="text-xs text-slate-400">{transactions.length} txns</span><button onClick={() => void supabase.auth.signOut()} className="text-slate-400" title="Sign out"><LogOut className="w-4 h-4" /></button></div>
        </header>

        <div className="hidden md:flex items-center h-12 px-4 bg-white border-b border-slate-200 flex-shrink-0">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1.5"
          >
            <Menu className="w-4 h-4" />
            {sidebarCollapsed ? 'Expand' : 'Collapse'} Menu
          </button>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <span className="text-xs text-slate-400">{profile.full_name || 'Signed in'} · {transactions.length > 0 ? `${transactions.length} transactions loaded` : 'No data loaded — use Statement Intelligence to begin'}</span>
            <button onClick={() => void supabase.auth.signOut()} className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1"><LogOut className="w-3.5 h-3.5" /> Sign out</button>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <Suspense fallback={<PageLoader />}>
              {renderPage()}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
    </NotificationProvider>
  );
}

export default App;
