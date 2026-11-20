import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BellRing,
  Code2,
  LogOut,
  Menu,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useFraudStream } from './hooks/useFraudStream';
import { AuthView } from './components/AuthView';
import { OverviewView } from './components/OverviewView';
import { AccessVerificationView } from './components/AccessVerificationView';
import { AlertsQueueView } from './components/AlertsQueueView';
import { RulesEngineView } from './components/RulesEngineView';
import { AdminUsersView } from './components/AdminUsersView';
import { JavaProjectView } from './components/JavaProjectView';
import { AlertDetailDrawer } from './components/AlertDetailDrawer';
import type { FraudAlert, TransactionRecord, UserRole } from './shared/types';

type NavTab = 'overview' | 'verify' | 'alerts' | 'rules' | 'users' | 'java';

const ANALYST_AVATAR_URL = '/src/assets/images/avatar_fraud_analyst_1795150479329.jpg';

const ALL_NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  breadcrumb: string;
  icon: typeof Activity;
  roles: UserRole[];
}> = [
  {
    id: 'overview',
    label: 'Overview',
    breadcrumb: 'Overview',
    icon: Activity,
    roles: ['ADMIN', 'ANALYST', 'CUSTOMER'],
  },
  {
    id: 'verify',
    label: 'Access Check',
    breadcrumb: 'Transaction & Access Check',
    icon: UserCheck,
    roles: ['ADMIN', 'ANALYST', 'CUSTOMER'],
  },
  {
    id: 'alerts',
    label: 'Alert Queue',
    breadcrumb: 'Suspicious Activity Alerts',
    icon: BellRing,
    roles: ['ADMIN', 'ANALYST', 'CUSTOMER'],
  },
  {
    id: 'rules',
    label: 'Detection Rules',
    breadcrumb: 'Detection Rules',
    icon: SlidersHorizontal,
    roles: ['ADMIN', 'ANALYST'],
  },
  {
    id: 'users',
    label: 'Users & RBAC',
    breadcrumb: 'Users, Roles & Audit Log',
    icon: Users,
    roles: ['ADMIN'],
  },
  {
    id: 'java',
    label: 'Java Project',
    breadcrumb: 'Java Spring Boot Project',
    icon: Code2,
    roles: ['ADMIN', 'ANALYST'],
  },
];

const ROLE_DISPLAY: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  ANALYST: 'Fraud Analyst',
  CUSTOMER: 'Bank Customer',
};

export default function App() {
  const { token, user, authLoading, login, register, logout } = useAuth();
  const {
    snapshot,
    loading,
    error,
    connectionState,
    liveToasts,
    dismissToast,
    evaluateActivity,
    triggerLiveBurst,
    toggleLiveMonitor,
    updateAlertStatus,
    addAlertNote,
    updateAccountStatus,
    updateRules,
    refresh,
  } = useFraudStream(token, logout);

  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const visibleNavItems = useMemo(() => {
    if (!user) return [];
    return ALL_NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  }, [user]);

  useEffect(() => {
    if (user && !visibleNavItems.some((item) => item.id === activeTab)) {
      setActiveTab('overview');
    }
  }, [user, visibleNavItems, activeTab]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F6FA] text-sm text-slate-600">
        Verifying session credentials...
      </div>
    );
  }

  if (!user || !token) {
    return <AuthView onLogin={login} onRegister={register} />;
  }

  const selectedAlert: FraudAlert | null =
    snapshot && selectedAlertId
      ? snapshot.alerts.find((a) => a.id === selectedAlertId) ?? null
      : null;

  const selectedTransaction: TransactionRecord | null =
    snapshot && selectedTxId
      ? snapshot.transactions.find((t) => t.id === selectedTxId) ?? null
      : selectedAlert && snapshot
        ? snapshot.transactions.find((t) => t.id === selectedAlert.transactionId) ?? null
        : null;

  const selectedAccount =
    snapshot && (selectedAlert || selectedTransaction)
      ? snapshot.accounts.find(
          (a) => a.id === (selectedAlert?.accountId ?? selectedTransaction?.accountId)
        ) ?? null
      : null;

  const handleInspectAlert = (alert: FraudAlert) => {
    setSelectedAlertId(alert.id);
    setSelectedTxId(alert.transactionId);
  };

  const handleInspectTransaction = (tx: TransactionRecord) => {
    const matchingAlert = snapshot?.alerts.find((a) => a.transactionId === tx.id);
    setSelectedAlertId(matchingAlert?.id ?? null);
    setSelectedTxId(tx.id);
  };

  const currentNav = visibleNavItems.find((n) => n.id === activeTab) ?? visibleNavItems[0];
  const initials = user.fullName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#F3F6FA] text-slate-900">
      {/* Desktop Deep Enterprise Navy Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0B1528] text-slate-200 border-r border-[#162745]">
        <div className="flex h-16 items-center gap-3 px-6 border-b border-white/10">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1D4ED8] text-white">
            <Shield className="h-4 w-4" />
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="text-left font-display text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Veritas FraudGuard
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1" aria-label="Primary navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const openCount = item.id === 'alerts' ? snapshot?.metrics.openAlerts ?? 0 : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1D4ED8] text-white shadow-xs'
                    : 'text-slate-300 hover:bg-white/8 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {openCount > 0 && (
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      isActive ? 'text-blue-100 font-semibold' : 'text-rose-400 font-semibold'
                    }`}
                  >
                    {openCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* WebSocket Stream Connection & Authenticated User Footer */}
        <div className="border-t border-white/10 bg-[#081020] p-4 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Alert Stream</span>
            <span
              className={`font-medium ${
                connectionState === 'connected'
                  ? 'text-emerald-400'
                  : connectionState === 'reconnecting'
                    ? 'text-amber-400'
                    : 'text-slate-400'
              }`}
            >
              {connectionState === 'connected'
                ? 'Live Connected'
                : connectionState === 'reconnecting'
                  ? 'Reconnecting'
                  : 'Connecting'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              {user.email === 'admin@veritasbank.com' && !avatarFailed ? (
                <img
                  src={ANALYST_AVATAR_URL}
                  alt={user.fullName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/20"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1B335E] text-xs font-semibold text-blue-100 ring-1 ring-white/15">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user.fullName}</p>
                <p className="text-[11px] text-slate-400 truncate">{ROLE_DISPLAY[user.role]}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#081020]/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex w-64 max-w-[80vw] flex-col bg-[#0B1528] text-slate-200 border-r border-white/10">
            <div className="flex h-16 items-center justify-between px-5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1D4ED8] text-white">
                  <Shield className="h-4 w-4" />
                </div>
                <span className="font-display text-base font-bold text-white whitespace-nowrap">
                  Veritas FraudGuard
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap ${
                      isActive
                        ? 'bg-[#1D4ED8] text-white'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-white/10 p-4">
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out ({user.role})
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        {/* Top Bar Contract: Breadcrumb Left — Primary Action Right */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-6 border-b border-[#DCE3EE] bg-white/95 backdrop-blur-xs px-4 sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 whitespace-nowrap shrink-0 hidden sm:inline">
                Veritas FraudGuard
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-[#0B1528] truncate">
                {currentNav?.breadcrumb ?? 'Overview'}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-5 shrink-0">
            <span className="hidden md:inline text-xs text-slate-500 whitespace-nowrap">
              {user.email} <span className="mx-1 text-slate-300">·</span>{' '}
              <strong className="font-semibold text-[#1D4ED8]">{user.role}</strong>
            </span>
            {user.role === 'CUSTOMER' ? (
              <button
                type="button"
                onClick={() => setActiveTab('verify')}
                className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
              >
                Verify Transaction
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('java')}
                className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
              >
                Java Project
              </button>
            )}
          </div>
        </header>

        {/* Live WebSocket Alert Toast Stack */}
        {liveToasts.length > 0 && (
          <div
            aria-live="assertive"
            className="fixed bottom-5 right-5 z-40 flex w-full max-w-sm flex-col gap-2.5 pointer-events-none"
          >
            {liveToasts.map(({ id, alert }) => (
              <div
                key={id}
                className="pointer-events-auto overflow-hidden rounded-xl border border-rose-200 bg-white shadow-xl"
              >
                <div className="flex items-center justify-between bg-rose-700 px-4 py-2 text-xs font-semibold text-white">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                    Real-Time Alert · Score {alert.riskScore}/100 ({Math.round(alert.mlFraudProbability * 100)}% ML)
                  </span>
                  <button
                    type="button"
                    onClick={() => dismissToast(id)}
                    className="text-rose-100 hover:text-white"
                    aria-label="Dismiss alert notification"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="p-4">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {alert.holderName} ({alert.location})
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{alert.summary}</p>
                  <div className="mt-3 flex items-center justify-end gap-3 border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleInspectAlert(alert);
                        dismissToast(id);
                      }}
                      className="text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF]"
                    >
                      Inspect Evidence
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active View Viewport */}
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8 max-w-[1440px] w-full mx-auto">
          {loading ? (
            <div className="space-y-6" aria-label="Loading fraud dashboard">
              <div className="h-8 w-72 rounded-md bg-slate-200/80 animate-pulse" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-28 rounded-xl border border-[#DCE3EE] bg-white p-5">
                    <div className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
                    <div className="mt-4 h-7 w-16 rounded bg-slate-200 animate-pulse" />
                  </div>
                ))}
              </div>
              <div className="h-72 rounded-xl border border-[#DCE3EE] bg-white animate-pulse" />
            </div>
          ) : error || !snapshot ? (
            <div className="rounded-xl border border-[#DCE3EE] bg-white p-10 text-center">
              <ShieldCheck className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 text-base font-semibold text-slate-900">
                Unable to load fraud monitoring stream
              </h2>
              <p className="mt-1 text-sm text-slate-600">{error ?? 'Connection lost.'}</p>
              <button
                type="button"
                onClick={refresh}
                className="mt-4 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewView
                  currentUser={user}
                  snapshot={snapshot}
                  onInspectAlert={handleInspectAlert}
                  onInspectTransaction={handleInspectTransaction}
                  onNavigate={setActiveTab}
                  onTriggerBurst={triggerLiveBurst}
                  onToggleLiveMonitor={toggleLiveMonitor}
                />
              )}

              {activeTab === 'verify' && (
                <AccessVerificationView
                  accounts={snapshot.accounts}
                  onEvaluate={evaluateActivity}
                  onUpdateAccountStatus={updateAccountStatus}
                />
              )}

              {activeTab === 'alerts' && (
                <AlertsQueueView
                  alerts={snapshot.alerts}
                  accounts={snapshot.accounts}
                  onInspectAlert={handleInspectAlert}
                  onUpdateAlertStatus={updateAlertStatus}
                  onUpdateAccountStatus={updateAccountStatus}
                />
              )}

              {activeTab === 'rules' && (user.role === 'ADMIN' || user.role === 'ANALYST') && (
                <RulesEngineView
                  userRole={user.role}
                  rules={snapshot.rules}
                  onSaveRules={updateRules}
                />
              )}

              {activeTab === 'users' && user.role === 'ADMIN' && (
                <AdminUsersView token={token} currentUser={user} />
              )}

              {activeTab === 'java' && (user.role === 'ADMIN' || user.role === 'ANALYST') && (
                <JavaProjectView token={token} rules={snapshot.rules} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Slide-Over Investigation Drawer */}
      <AlertDetailDrawer
        currentUser={user}
        alert={selectedAlert}
        transaction={selectedTransaction}
        account={selectedAccount}
        onClose={() => {
          setSelectedAlertId(null);
          setSelectedTxId(null);
        }}
        onUpdateAlertStatus={updateAlertStatus}
        onAddAlertNote={addAlertNote}
        onUpdateAccountStatus={updateAccountStatus}
      />
    </div>
  );
}
