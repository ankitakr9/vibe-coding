import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Code2,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  Terminal,
  X,
} from 'lucide-react';
import { AuthPortal } from './components/AuthPortal';
import { ConsolePanel } from './components/ConsolePanel';
import { FileStoragePanel } from './components/FileStoragePanel';
import { JavaSourcePanel } from './components/JavaSourcePanel';
import { OverviewPanel } from './components/OverviewPanel';
import { TransactionsPanel } from './components/TransactionsPanel';
import { ApiError, bankingApi } from './services/api';
import type {
  AccountSummary,
  AuthResponse,
  OperationResult,
  RecipientOption,
  TransactionRecord,
} from './types/banking';
import { formatCurrency } from './utils/format';

type NavSection = 'overview' | 'transactions' | 'console' | 'storage' | 'java';

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  breadcrumb: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', breadcrumb: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', breadcrumb: 'Transaction Ledger', icon: ArrowLeftRight },
  { id: 'console', label: 'Console Mode', breadcrumb: 'Interactive Console', icon: Terminal },
  { id: 'storage', label: 'File Storage', breadcrumb: 'File Persistence', icon: Database },
  { id: 'java', label: 'Java & JavaFX', breadcrumb: 'Core Java Source', icon: Code2 },
];

export default function App() {
  // Auth token stored strictly in React memory (never persisted to localStorage)
  const [token, setToken] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [welcomeAccountCreated, setWelcomeAccountCreated] = useState(false);

  const [activeNav, setActiveNav] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [storageRefreshSignal, setStorageRefreshSignal] = useState(0);

  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const clearSession = useCallback(() => {
    setToken(null);
    setAccount(null);
    setRecipients([]);
    setTransactions([]);
    setGlobalError(null);
    setWelcomeAccountCreated(false);
    setActiveNav('overview');
    setMobileMenuOpen(false);
  }, []);

  const refreshAccountData = useCallback(
    async (activeToken: string) => {
      setLoadingLedger(true);
      setGlobalError(null);
      try {
        const [accountRes, txRes] = await Promise.all([
          bankingApi.getAccount(activeToken),
          bankingApi.getTransactions(activeToken, { sort: 'desc' }),
        ]);
        setAccount(accountRes.account);
        setRecipients(accountRes.recipients);
        setTransactions(txRes.transactions);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          return;
        }
        setGlobalError(err instanceof ApiError ? err.message : 'Unable to sync account ledger.');
      } finally {
        setLoadingLedger(false);
      }
    },
    [clearSession]
  );

  useEffect(() => {
    if (token) {
      void refreshAccountData(token);
    }
  }, [token, refreshAccountData]);

  const handleAuthenticated = (auth: AuthResponse, newlyCreated = false) => {
    setToken(auth.token);
    setAccount(auth.account);
    setRecipients(auth.recipients);
    setWelcomeAccountCreated(newlyCreated);
    setActiveNav('overview');
  };

  const handleOperationSuccess = (result: OperationResult) => {
    setAccount(result.account);
    setTransactions((prev) => [result.transaction, ...prev]);
    setStorageRefreshSignal((n) => n + 1);
  };

  const handleSignOut = async () => {
    if (token) {
      try {
        await bankingApi.logout(token);
      } catch {
        // Session cleared client-side regardless of network failure
      }
    }
    clearSession();
  };

  const handleQuickNewTransaction = () => {
    setActiveNav('overview');
    setMobileMenuOpen(false);
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 60);
  };

  if (!token || !account) {
    return <AuthPortal onAuthenticated={handleAuthenticated} />;
  }

  const activeNavMeta = NAV_ITEMS.find((item) => item.id === activeNav) ?? NAV_ITEMS[0];

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
          Alder Bank
        </span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-2 -mr-2 text-slate-500 hover:text-slate-900 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1" aria-label="Primary workspace navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveNav(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full px-3.5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-emerald-50 text-emerald-900'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-emerald-700' : 'text-slate-400'
                }`}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Signed-in Account Footer */}
      <div className="p-4 border-t border-slate-200 space-y-3">
        <div className="px-2">
          <p className="text-sm font-semibold text-slate-900 truncate">{account.fullName}</p>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 font-mono tabular-nums">
            <span>{account.accountNumber}</span>
            <span aria-hidden="true">·</span>
            <span>{formatCurrency(account.balanceCents)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[80vw] bg-white h-full border-r border-slate-200">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary action on right */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-20 px-4 sm:px-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 whitespace-nowrap shrink-0">Alder Bank</span>
              <span aria-hidden="true" className="text-slate-300">/</span>
              <span className="font-medium text-slate-900 truncate">
                {activeNavMeta.breadcrumb}
              </span>
            </div>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleQuickNewTransaction}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              New Transaction
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-8">
          {globalError && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between gap-4"
            >
              <span>
                <span className="font-semibold">Sync Error:</span> {globalError}
              </span>
              <button
                type="button"
                onClick={() => void refreshAccountData(token)}
                className="px-3 py-1.5 text-xs font-medium text-red-800 bg-white border border-red-200 rounded-md hover:bg-red-50 whitespace-nowrap cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {activeNav === 'overview' && (
            <OverviewPanel
              token={token}
              account={account}
              recipients={recipients}
              transactions={transactions}
              loading={loadingLedger}
              welcomeAccountCreated={welcomeAccountCreated}
              onDismissWelcome={() => setWelcomeAccountCreated(false)}
              onOperationSuccess={handleOperationSuccess}
              onNavigateTransactions={() => setActiveNav('transactions')}
              amountInputRef={amountInputRef}
            />
          )}

          {activeNav === 'transactions' && (
            <TransactionsPanel
              token={token}
              account={account}
              transactions={transactions}
              loading={loadingLedger}
              onMakeFirstTransaction={handleQuickNewTransaction}
            />
          )}

          {activeNav === 'console' && (
            <ConsolePanel
              token={token}
              account={account}
              recipients={recipients}
              transactions={transactions}
              onOperationSuccess={handleOperationSuccess}
            />
          )}

          {activeNav === 'storage' && (
            <FileStoragePanel
              token={token}
              account={account}
              refreshSignal={storageRefreshSignal}
            />
          )}

          {activeNav === 'java' && <JavaSourcePanel />}
        </main>
      </div>
    </div>
  );
}
