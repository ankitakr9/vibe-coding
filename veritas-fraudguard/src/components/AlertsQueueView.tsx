import { useMemo, useState } from 'react';
import { Lock, Search, ShieldAlert, Unlock } from 'lucide-react';
import type {
  AccountProfile,
  AccountStatus,
  AlertStatus,
  FraudAlert,
} from '../shared/types';

interface AlertsQueueViewProps {
  alerts: FraudAlert[];
  accounts: AccountProfile[];
  onInspectAlert: (alert: FraudAlert) => void;
  onUpdateAlertStatus: (alertId: string, status: AlertStatus) => Promise<void>;
  onUpdateAccountStatus: (accountId: string, status: AccountStatus) => Promise<void>;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val);

const formatTimestamp = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const statusLabels: Record<AlertStatus, string> = {
  OPEN: 'Open',
  INVESTIGATING: 'Investigating',
  RESOLVED_FRAUD: 'Confirmed Fraud',
  FALSE_POSITIVE: 'False Positive',
};

export function AlertsQueueView({
  alerts,
  accounts,
  onInspectAlert,
  onUpdateAlertStatus,
  onUpdateAccountStatus,
}: AlertsQueueViewProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | AlertStatus>('ALL');
  const [query, setQuery] = useState('');

  const filteredAlerts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts.filter((alert) => {
      if (statusFilter !== 'ALL' && alert.status !== statusFilter) return false;
      if (!q) return true;
      return (
        alert.holderName.toLowerCase().includes(q) ||
        alert.id.toLowerCase().includes(q) ||
        alert.location.toLowerCase().includes(q) ||
        alert.ipAddress.toLowerCase().includes(q) ||
        alert.summary.toLowerCase().includes(q)
      );
    });
  }, [alerts, statusFilter, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0B1528]">
          Suspicious Activity Alerts and Account Controls
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Investigate real-time unauthorized access alerts, record dispositions, and lock compromised bank accounts.
        </p>
      </div>

      {/* Alert Queue Table */}
      <section className="rounded-xl border border-[#DCE3EE] bg-white shadow-[0_1px_2px_rgba(11,21,40,0.04)] overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#E4E9F2] px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-1 rounded-lg bg-[#EFF3F9] p-1 overflow-x-auto" role="tablist">
            {(
              [
                { id: 'ALL', label: `All (${alerts.length})` },
                { id: 'OPEN', label: `Open (${alerts.filter((a) => a.status === 'OPEN').length})` },
                { id: 'INVESTIGATING', label: 'Investigating' },
                { id: 'RESOLVED_FRAUD', label: 'Confirmed Fraud' },
                { id: 'FALSE_POSITIVE', label: 'False Positive' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={statusFilter === tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-white text-[#1D4ED8] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search alert ID, customer, IP..."
              className="h-9 w-full sm:w-64 rounded-lg border border-[#CBD5E1] bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4E9F2] bg-[#F7F9FC] text-slate-600">
                <th className="py-3 pl-6 pr-3 font-semibold">Alert &amp; Time</th>
                <th className="px-3 py-3 font-semibold">Customer</th>
                <th className="px-3 py-3 font-semibold">Detection Summary</th>
                <th className="px-3 py-3 font-semibold">Severity</th>
                <th className="px-3 py-3 text-right font-semibold">Score</th>
                <th className="px-3 py-3 text-right font-semibold">Exposure</th>
                <th className="py-3 pl-3 pr-6 text-right font-semibold">Disposition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7]">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    No alerts match the current status filter.
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => (
                  <tr
                    key={alert.id}
                    onClick={() => onInspectAlert(alert)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <td className="whitespace-nowrap py-3.5 pl-6 pr-3">
                      <div className="font-mono font-medium text-slate-900 tabular-nums">{alert.id}</div>
                      <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {formatTimestamp(alert.createdAt)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5">
                      <div className="font-medium text-slate-900">{alert.holderName}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {alert.accountNumber} · {alert.location}
                      </div>
                    </td>
                    <td className="max-w-sm px-3 py-3.5">
                      <div className="font-medium text-slate-800 truncate">{alert.title}</div>
                      <div className="truncate text-[11px] text-slate-500">{alert.summary}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 font-semibold ${
                          alert.severity === 'CRITICAL'
                            ? 'text-red-700'
                            : alert.severity === 'HIGH'
                              ? 'text-amber-700'
                              : 'text-slate-700'
                        }`}
                      >
                        {alert.unauthorizedUserDetected && <ShieldAlert className="h-3.5 w-3.5 shrink-0" />}
                        {alert.severity}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {alert.riskScore}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-900">
                      {alert.amount > 0 ? formatCurrency(alert.amount) : '—'}
                    </td>
                    <td
                      className="whitespace-nowrap py-3.5 pl-3 pr-6 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select
                        aria-label={`Change status for alert ${alert.id}`}
                        value={alert.status}
                        onChange={(e) => onUpdateAlertStatus(alert.id, e.target.value as AlertStatus)}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none"
                      >
                        {(Object.keys(statusLabels) as AlertStatus[]).map((st) => (
                          <option key={st} value={st}>
                            {statusLabels[st]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Monitored Customer Accounts & Enrolled Devices */}
      <section className="rounded-xl border border-[#DCE3EE] bg-white shadow-[0_1px_2px_rgba(11,21,40,0.04)] overflow-hidden">
        <div className="border-b border-[#E4E9F2] px-6 py-4">
          <h2 className="text-base font-semibold text-[#0B1528]">
            Monitored Bank Accounts and Trusted Devices
          </h2>
          <p className="text-xs text-slate-500">
            Freeze an account immediately to block all incoming wire transfers, card charges, and sign-in attempts.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4E9F2] bg-[#F7F9FC] text-slate-600">
                <th className="py-3 pl-6 pr-3 font-semibold">Holder &amp; Tier</th>
                <th className="px-3 py-3 font-semibold">Account Number</th>
                <th className="px-3 py-3 font-semibold">Enrolled Trusted Devices</th>
                <th className="px-3 py-3 font-semibold">Last Verified Location</th>
                <th className="px-3 py-3 text-right font-semibold">Daily Limit</th>
                <th className="px-3 py-3 font-semibold">State</th>
                <th className="py-3 pl-3 pr-6 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7]">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="whitespace-nowrap py-3.5 pl-6 pr-3">
                    <div className="font-medium text-slate-900">{acc.holderName}</div>
                    <div className="text-[11px] text-slate-500">{acc.tier}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 font-mono text-slate-700">
                    {acc.accountNumber}
                  </td>
                  <td className="max-w-xs px-3 py-3.5 text-slate-600">
                    {acc.trustedDevices.map((d) => d.label).join(' · ')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5">
                    <div className="text-slate-800">
                      {acc.lastVerifiedCity}, {acc.lastVerifiedCountry}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">{acc.lastIp}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono tabular-nums text-slate-900">
                    {formatCurrency(acc.dailyLimit)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5">
                    <span
                      className={`font-semibold ${
                        acc.status === 'FROZEN' ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {acc.status === 'FROZEN' ? 'Frozen' : 'Active'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-3.5 pl-3 pr-6 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateAccountStatus(acc.id, acc.status === 'FROZEN' ? 'ACTIVE' : 'FROZEN')
                      }
                      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        acc.status === 'FROZEN'
                          ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                          : 'border border-red-200 bg-white text-red-700 hover:bg-red-50'
                      }`}
                    >
                      {acc.status === 'FROZEN' ? (
                        <>
                          <Unlock className="h-3.5 w-3.5" />
                          Unfreeze
                        </>
                      ) : (
                        <>
                          <Lock className="h-3.5 w-3.5" />
                          Freeze
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
