import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Cpu,
  DollarSign,
  Pause,
  Play,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type {
  AccountProfile,
  AuthUser,
  DashboardSnapshot,
  FraudAlert,
  RiskVerdict,
  TransactionRecord,
} from '../shared/types';

interface OverviewViewProps {
  currentUser: AuthUser;
  snapshot: DashboardSnapshot;
  onInspectAlert: (alert: FraudAlert) => void;
  onInspectTransaction: (tx: TransactionRecord) => void;
  onNavigate: (tab: 'overview' | 'verify' | 'alerts' | 'rules' | 'users' | 'java') => void;
  onTriggerBurst: () => Promise<void>;
  onToggleLiveMonitor: (enabled?: boolean) => Promise<{ liveMonitorRunning: boolean }>;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val);

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

const eventLabel: Record<string, string> = {
  LOGIN_ATTEMPT: 'Portal Sign-In',
  WIRE_TRANSFER: 'Wire Transfer',
  CARD_PAYMENT: 'Card Payment',
  ACH_WITHDRAWAL: 'ACH Withdrawal',
  PASSWORD_RESET: 'Password Reset',
};

export function OverviewView({
  currentUser,
  snapshot,
  onInspectAlert,
  onInspectTransaction,
  onNavigate,
  onTriggerBurst,
  onToggleLiveMonitor,
}: OverviewViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<'ALL' | RiskVerdict>('ALL');
  const [burstRunning, setBurstRunning] = useState(false);
  const [monitorBusy, setMonitorBusy] = useState(false);

  const isStaff = currentUser.role === 'ADMIN' || currentUser.role === 'ANALYST';

  const activeAlerts = useMemo(
    () =>
      snapshot.alerts
        .filter((a) => a.status === 'OPEN' || a.status === 'INVESTIGATING')
        .slice(0, 5),
    [snapshot.alerts]
  );

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return snapshot.transactions.filter((tx) => {
      if (verdictFilter !== 'ALL' && tx.verdict !== verdictFilter) return false;
      if (!q) return true;
      return (
        tx.holderName.toLowerCase().includes(q) ||
        tx.accountNumber.toLowerCase().includes(q) ||
        tx.city.toLowerCase().includes(q) ||
        tx.ipAddress.toLowerCase().includes(q) ||
        tx.merchantOrTarget.toLowerCase().includes(q) ||
        tx.id.toLowerCase().includes(q)
      );
    });
  }, [snapshot.transactions, searchQuery, verdictFilter]);

  const handleBurst = async () => {
    setBurstRunning(true);
    try {
      await onTriggerBurst();
    } finally {
      window.setTimeout(() => setBurstRunning(false), 2600);
    }
  };

  const handleToggleMonitor = async () => {
    setMonitorBusy(true);
    try {
      await onToggleLiveMonitor(!snapshot.liveMonitorRunning);
    } finally {
      setMonitorBusy(false);
    }
  };

  const accountById = useMemo(() => {
    const map = new Map<string, AccountProfile>();
    for (const acc of snapshot.accounts) map.set(acc.id, acc);
    return map;
  }, [snapshot.accounts]);

  return (
    <div className="space-y-6">
      {/* Page Title & Real-Time Stream Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0B1528]">
            {isStaff
              ? 'Real-Time Transaction Monitoring and Fraud Dashboard'
              : 'Personal Account Security Overview'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {isStaff
              ? 'Hybrid rule-based and calibrated ML scoring across live banking transactions, unauthorized sign-ins, and alert triage.'
              : `Scoped protection for ${snapshot.accounts[0]?.holderName ?? currentUser.fullName} (${snapshot.accounts[0]?.accountNumber ?? 'linked account'}).`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isStaff && (
            <>
              <button
                type="button"
                onClick={handleToggleMonitor}
                disabled={monitorBusy}
                className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  snapshot.liveMonitorRunning
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                    : 'border-[#CBD5E1] bg-white text-slate-800 hover:bg-[#F7F9FC]'
                }`}
              >
                {snapshot.liveMonitorRunning ? (
                  <>
                    <Pause className="h-3.5 w-3.5 text-emerald-700" />
                    Pause Live Feed
                  </>
                ) : (
                  <>
                    <Radio className="h-3.5 w-3.5 text-[#1D4ED8]" />
                    Start Live Feed
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleBurst}
                disabled={burstRunning}
                className="inline-flex items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-[#F7F9FC] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="h-3.5 w-3.5 text-[#1D4ED8]" />
                {burstRunning ? 'Streaming 3 Events...' : 'Run Traffic Burst'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onNavigate('verify')}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1E40AF] transition-colors whitespace-nowrap shrink-0"
          >
            Check Transaction
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 4-Column Enterprise KPI Strip with Tonal Anchors */}
      <section
        aria-label="Key fraud metrics"
        className="grid grid-cols-1 divide-y divide-[#E4E9F2] rounded-xl border border-[#DCE3EE] bg-white shadow-[0_1px_2px_rgba(11,21,40,0.04)] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x"
      >
        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Unauthorized Blocked</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-rose-700">
            {snapshot.metrics.unauthorizedBlocked}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Out of {snapshot.metrics.totalEvaluated} scored events
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Open Priority Alerts</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <BellRing className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[#0B1528]">
            {snapshot.metrics.openAlerts}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {snapshot.metrics.criticalAlerts} critical · {snapshot.metrics.frozenAccounts} frozen
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Exposure Prevented</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-emerald-700">
            {formatCurrency(snapshot.metrics.exposurePreventedUsd)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Blocked prior to settlement</p>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Mean Composite / ML Risk</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#1D4ED8]">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[#0B1528]">
            {snapshot.metrics.averageRiskScore}
            <span className="text-base font-medium text-[#1D4ED8]">
              {' '}
              · {Math.round(snapshot.metrics.avgMlProbability * 100)}%
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Auto-block cutoff at {snapshot.rules.blockThreshold}/100
          </p>
        </div>
      </section>

      {/* Main 2-Column Analytical Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        <section className="flex flex-col rounded-xl border border-[#DCE3EE] bg-white shadow-[0_1px_2px_rgba(11,21,40,0.04)] p-6 lg:col-span-7">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[#0B1528]">
                Hourly Decision Distribution
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Authorized traffic vs. step-up MFA challenges and blocked unauthorized attempts.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#1D4ED8]" aria-hidden="true" />
                Authorized
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#D97706]" aria-hidden="true" />
                MFA Challenge
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#BE123C]" aria-hidden="true" />
                Blocked
              </span>
            </div>
          </div>

          <div className="mt-6 h-64 w-full min-w-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={snapshot.hourlySeries}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                barGap={5}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E9F2" />
                <XAxis
                  dataKey="hour"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748B', fontFamily: 'IBM Plex Mono' }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748B', fontFamily: 'IBM Plex Mono' }}
                />
                <Tooltip
                  cursor={{ fill: '#F3F6FA' }}
                  contentStyle={{
                    backgroundColor: '#0B1528',
                    borderColor: '#1B335E',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                    fontFamily: 'Public Sans',
                  }}
                  labelStyle={{ color: '#93C5FD', fontFamily: 'IBM Plex Mono', marginBottom: '4px' }}
                  itemStyle={{ color: '#F8FAFC' }}
                />
                <Bar
                  dataKey="authorized"
                  name="Authorized"
                  fill="#1D4ED8"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={26}
                />
                <Bar
                  dataKey="challenged"
                  name="MFA Challenge"
                  fill="#D97706"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={26}
                />
                <Bar
                  dataKey="blockedUnauthorized"
                  name="Blocked Unauthorized"
                  fill="#BE123C"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={26}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Active Suspicious Activity Queue */}
        <section className="flex flex-col rounded-xl border border-[#DCE3EE] bg-white shadow-[0_1px_2px_rgba(11,21,40,0.04)] lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#E4E9F2] bg-[#F7F9FC] rounded-t-xl px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#0B1528]">Active Alert Queue</h2>
              <p className="text-xs text-slate-500">
                Inspect ML features, post case notes, or freeze account
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('alerts')}
              className="text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] whitespace-nowrap shrink-0"
            >
              View All ({snapshot.alerts.length})
            </button>
          </div>

          {activeAlerts.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <ShieldCheck className="h-8 w-8 text-emerald-700" />
              <p className="mt-3 text-sm font-semibold text-slate-900">No unresolved alerts</p>
              <p className="mt-1 text-xs text-slate-500">
                All suspicious events have been resolved. Start the live feed or run an access check to inspect real-time alerting.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#EEF2F7] flex-1">
              {activeAlerts.map((alert) => {
                const account = accountById.get(alert.accountId);
                return (
                  <li key={alert.id}>
                    <button
                      type="button"
                      onClick={() => onInspectAlert(alert)}
                      className="w-full px-6 py-3.5 text-left hover:bg-[#F4F7FC] transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#1D4ED8]"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-semibold text-[#0B1528] truncate">
                          {alert.holderName}
                          {account?.status === 'FROZEN' && (
                            <span className="ml-2 text-xs font-medium text-rose-700">Frozen</span>
                          )}
                        </span>
                        <span
                          className={`font-mono text-xs font-semibold tabular-nums shrink-0 ${
                            alert.severity === 'CRITICAL'
                              ? 'text-rose-700'
                              : alert.severity === 'HIGH'
                                ? 'text-amber-700'
                                : 'text-[#1D4ED8]'
                          }`}
                        >
                          {alert.severity} · {alert.riskScore} ({Math.round(alert.mlFraudProbability * 100)}% ML)
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600 truncate">{alert.summary}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                        <span>{alert.location}</span>
                        <span aria-hidden="true">·</span>
                        <span>{alert.amount > 0 ? formatCurrency(alert.amount) : 'Auth event'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatTime(alert.createdAt)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Live Transaction & Unauthorized Access Ledger */}
      <section className="rounded-xl border border-[#DCE3EE] bg-white shadow-[0_1px_2px_rgba(11,21,40,0.04)] overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#E4E9F2] px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#0B1528]">
              Live Access and Transaction Ledger
            </h2>
            <p className="text-xs text-slate-500">
              {snapshot.liveMonitorRunning
                ? 'Continuous server-side monitoring feed is actively ingesting and scoring transactions.'
                : 'Real-time server-scored activity stream updated automatically over authenticated WebSocket.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter holder, IP, city..."
                className="h-9 w-56 rounded-lg border border-[#CBD5E1] bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 focus:outline-none"
              />
            </div>

            <div
              className="flex items-center gap-1 rounded-lg bg-[#EFF3F9] p-1"
              role="tablist"
              aria-label="Filter by verdict"
            >
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'BLOCKED_UNAUTHORIZED', label: 'Blocked' },
                  { id: 'CHALLENGE_MFA', label: 'MFA Review' },
                  { id: 'AUTHORIZED', label: 'Authorized' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={verdictFilter === tab.id}
                  onClick={() => setVerdictFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    verdictFilter === tab.id
                      ? 'bg-white text-[#1D4ED8] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4E9F2] bg-[#F7F9FC] text-slate-600">
                <th className="py-3 pl-6 pr-3 font-semibold">Time</th>
                <th className="px-3 py-3 font-semibold">Account Holder</th>
                <th className="px-3 py-3 font-semibold">Activity &amp; Target</th>
                <th className="px-3 py-3 font-semibold">Origin &amp; IP</th>
                <th className="px-3 py-3 font-semibold">Verdict</th>
                <th className="px-3 py-3 text-right font-semibold">Score / ML</th>
                <th className="py-3 pl-3 pr-6 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7]">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    No matching transactions found for the current filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.slice(0, 14).map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => onInspectTransaction(tx)}
                    className="cursor-pointer hover:bg-[#F4F7FC] transition-colors"
                  >
                    <td className="whitespace-nowrap py-3 pl-6 pr-3 font-mono tabular-nums text-slate-500">
                      {formatTime(tx.timestamp)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="font-semibold text-[#0B1528]">{tx.holderName}</div>
                      <div className="font-mono text-[11px] text-slate-400">{tx.accountNumber}</div>
                    </td>
                    <td className="max-w-xs truncate px-3 py-3">
                      <div className="font-medium text-slate-800">
                        {eventLabel[tx.eventType] ?? tx.eventType}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {tx.merchantOrTarget}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="text-slate-800">
                        {tx.city}, {tx.country}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        {tx.ipAddress}
                        {tx.isVpnOrTor ? ' · Proxy/Tor' : ''}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {tx.verdict === 'BLOCKED_UNAUTHORIZED' ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700">
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                          Blocked Unauthorized
                        </span>
                      ) : tx.verdict === 'CHALLENGE_MFA' ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Step-Up MFA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                          Authorized
                        </span>
                      )}
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-3 text-right font-mono font-semibold tabular-nums ${
                        tx.riskScore >= 68
                          ? 'text-rose-700'
                          : tx.riskScore >= 40
                            ? 'text-amber-700'
                            : 'text-[#1D4ED8]'
                      }`}
                    >
                      {tx.riskScore}{' '}
                      <span className="font-normal text-slate-400">
                        ({Math.round(tx.mlFraudProbability * 100)}%)
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-3 pl-3 pr-6 text-right font-mono font-medium tabular-nums text-[#0B1528]">
                      {tx.amount > 0 ? formatCurrency(tx.amount) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
