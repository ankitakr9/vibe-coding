import { useState } from 'react';
import { Lock, MessageSquarePlus, ShieldAlert, ShieldCheck, Unlock, X } from 'lucide-react';
import type {
  AccountProfile,
  AccountStatus,
  AlertStatus,
  AuthUser,
  FraudAlert,
  TransactionRecord,
} from '../shared/types';

interface AlertDetailDrawerProps {
  currentUser: AuthUser;
  alert: FraudAlert | null;
  transaction: TransactionRecord | null;
  account: AccountProfile | null;
  onClose: () => void;
  onUpdateAlertStatus: (alertId: string, status: AlertStatus) => Promise<void>;
  onAddAlertNote: (alertId: string, text: string) => Promise<void>;
  onUpdateAccountStatus: (accountId: string, status: AccountStatus) => Promise<void>;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(val);

const formatTimestamp = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

const statusTextMap: Record<AlertStatus, string> = {
  OPEN: 'Open',
  INVESTIGATING: 'Investigating',
  RESOLVED_FRAUD: 'Confirmed Fraud',
  FALSE_POSITIVE: 'False Positive',
};

export function AlertDetailDrawer({
  currentUser,
  alert,
  transaction,
  account,
  onClose,
  onUpdateAlertStatus,
  onAddAlertNote,
  onUpdateAccountStatus,
}: AlertDetailDrawerProps) {
  const [noteInput, setNoteInput] = useState('');
  const [postingNote, setPostingNote] = useState(false);

  if (!alert && !transaction) return null;

  const isStaff = currentUser.role === 'ADMIN' || currentUser.role === 'ANALYST';
  const isUnauthorized = alert?.unauthorizedUserDetected ?? transaction?.isUnauthorizedUser ?? false;
  const riskScore = alert?.riskScore ?? transaction?.riskScore ?? 0;
  const mlProb = alert?.mlFraudProbability ?? transaction?.mlFraudProbability ?? 0;
  const mlFeatures = transaction?.mlFeatures ?? [];
  const triggeredRules = alert?.triggeredRules ?? transaction?.triggeredRules ?? [];
  const holderName = alert?.holderName ?? transaction?.holderName ?? account?.holderName ?? 'Unknown';
  const accountNumber = alert?.accountNumber ?? transaction?.accountNumber ?? account?.accountNumber ?? '';
  const ipAddress = alert?.ipAddress ?? transaction?.ipAddress ?? '';
  const deviceLabel = alert?.deviceLabel ?? transaction?.deviceLabel ?? '';
  const location = alert?.location ?? (transaction ? `${transaction.city}, ${transaction.country}` : '');
  const amount = alert?.amount ?? transaction?.amount ?? 0;
  const timestamp = alert?.createdAt ?? transaction?.timestamp ?? '';
  const eventType = alert?.eventType ?? transaction?.eventType ?? 'LOGIN_ATTEMPT';

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alert || !noteInput.trim()) return;
    setPostingNote(true);
    try {
      await onAddAlertNote(alert.id, noteInput);
      setNoteInput('');
    } finally {
      setPostingNote(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#081020]/50 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-label="Case inspection details"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white border-l border-[#DCE3EE] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#0B1528] px-6 py-5 text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-blue-200/80 font-mono tabular-nums">
              <span>{alert ? alert.id : transaction?.id}</span>
              <span aria-hidden="true">·</span>
              <span>{formatTimestamp(timestamp)}</span>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {alert ? alert.title : `${holderName} — ${eventType.replace(/_/g, ' ')}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400"
            aria-label="Close inspection drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Hybrid Rule + ML Score Strip */}
          <div className="grid grid-cols-3 gap-4 border-b border-slate-200 pb-6">
            <div>
              <p className="text-xs text-slate-500">Composite Risk</p>
              <p
                className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
                  riskScore >= 68
                    ? 'text-red-700'
                    : riskScore >= 40
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                }`}
              >
                {riskScore}/100
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">ML Fraud Prob.</p>
              <p
                className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
                  mlProb >= 0.75
                    ? 'text-red-700'
                    : mlProb >= 0.45
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                }`}
              >
                {Math.round(mlProb * 100)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Identity Check</p>
              <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
                {isUnauthorized ? (
                  <>
                    <ShieldAlert className="h-4 w-4 text-red-700 shrink-0" />
                    <span className="text-red-700">Unauthorized</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
                    <span className="text-emerald-700">Verified</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Session & Telemetry Details */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Account and Session Evidence</h3>
            <dl className="mt-3 divide-y divide-slate-100 border-t border-b border-slate-200 text-sm">
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500">Account Holder</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {holderName}{' '}
                  <span className="font-mono text-xs text-slate-500 ml-1">{accountNumber}</span>
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500">Transaction Amount</dt>
                <dd className="font-mono font-medium tabular-nums text-slate-900 text-right">
                  {amount > 0 ? formatCurrency(amount) : 'Authentication Event'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500">Incoming Location</dt>
                <dd className="text-slate-900 text-right">{location}</dd>
              </div>
              {transaction && transaction.distanceFromLastKm > 0 && (
                <div className="flex justify-between gap-4 py-2.5">
                  <dt className="text-slate-500">Geo-Velocity Shift</dt>
                  <dd className="font-mono tabular-nums text-slate-900 text-right">
                    {transaction.distanceFromLastKm.toLocaleString()} km (
                    {transaction.travelSpeedKmh.toLocaleString()} km/h)
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500">Source IP Address</dt>
                <dd className="font-mono tabular-nums text-slate-900 text-right">{ipAddress}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-500">Client Device</dt>
                <dd className="text-slate-900 text-right">{deviceLabel}</dd>
              </div>
            </dl>
          </div>

          {/* ML Model Feature Attributions */}
          {mlFeatures.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                ML Anomaly Model Feature Attributions
              </h3>
              <ul className="mt-2.5 divide-y divide-slate-100 border-t border-b border-slate-200 text-xs">
                {mlFeatures.map((feat) => (
                  <li key={feat.feature} className="py-2.5 flex items-baseline justify-between gap-3">
                    <div>
                      <span className="font-medium text-slate-900">{feat.feature}</span>
                      <p className="text-[11px] text-slate-500">{feat.explanation}</p>
                    </div>
                    <span className="font-mono font-semibold tabular-nums text-blue-700 shrink-0">
                      +{feat.contribution.toFixed(2)} logit
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Triggered Rules */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Triggered Detection Rules ({triggeredRules.length})
            </h3>
            {triggeredRules.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                No fraud or unauthorized access rules were tripped.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-200 border-t border-b border-slate-200">
                {triggeredRules.map((rule) => (
                  <li key={`${rule.code}-${rule.detail}`} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium text-slate-900">{rule.label}</span>
                      <span className="font-mono text-xs font-semibold tabular-nums text-red-700 shrink-0">
                        +{rule.scoreImpact} pts
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{rule.detail}</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">
                      Rule {rule.code} · {rule.category.replace(/_/g, ' ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Triage Workflow (Role-Aware) */}
          {alert && (
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  {isStaff ? 'Case Disposition' : 'Customer Verification Response'}
                </h3>
                <span className="text-xs text-slate-500">
                  Current: <strong className="text-slate-900">{statusTextMap[alert.status]}</strong>
                </span>
              </div>
              {isStaff ? (
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onUpdateAlertStatus(alert.id, 'INVESTIGATING')}
                    className={`px-4 py-2.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      alert.status === 'INVESTIGATING'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Mark Investigating
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateAlertStatus(alert.id, 'RESOLVED_FRAUD')}
                    className={`px-4 py-2.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      alert.status === 'RESOLVED_FRAUD'
                        ? 'bg-red-700 text-white border-red-700'
                        : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
                    }`}
                  >
                    Confirm Fraud
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateAlertStatus(alert.id, 'FALSE_POSITIVE')}
                    className={`px-4 py-2.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      alert.status === 'FALSE_POSITIVE'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Dismiss False Positive
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateAlertStatus(alert.id, 'OPEN')}
                    className="px-4 py-2.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    Reopen Alert
                  </button>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onUpdateAlertStatus(alert.id, 'FALSE_POSITIVE')}
                    className="px-4 py-2.5 text-xs font-medium rounded-lg border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50 transition-colors whitespace-nowrap"
                  >
                    Confirm This Was Me
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateAlertStatus(alert.id, 'RESOLVED_FRAUD')}
                    className="px-4 py-2.5 text-xs font-medium rounded-lg bg-red-700 text-white hover:bg-red-800 transition-colors whitespace-nowrap"
                  >
                    Report Unauthorized
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Case Investigation Notes (Admin & Analyst) */}
          {alert && isStaff && (
            <div className="border-t border-slate-200 pt-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Case Investigation Notes ({alert.notes.length})
              </h3>
              <form onSubmit={handlePostNote} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Document outreach, chargeback ref, or device verification..."
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={postingNote || !noteInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  Add Note
                </button>
              </form>

              {alert.notes.length > 0 && (
                <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-200">
                  {alert.notes.map((note) => (
                    <li key={note.id} className="py-3 text-xs">
                      <div className="flex items-center justify-between gap-2 text-slate-500">
                        <span className="font-medium text-slate-900">
                          {note.authorName} · {note.authorRole}
                        </span>
                        <span className="font-mono text-[11px] tabular-nums">
                          {formatTimestamp(note.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-700 leading-relaxed">{note.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Account Protection Footer */}
        {account && (
          <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <div className="text-xs text-slate-600">
              Account <span className="font-mono text-slate-900">{account.accountNumber}</span> is{' '}
              <span
                className={
                  account.status === 'FROZEN'
                    ? 'font-semibold text-red-700'
                    : 'font-semibold text-emerald-700'
                }
              >
                {account.status === 'FROZEN' ? 'Frozen' : 'Active'}
              </span>
            </div>
            {account.status === 'FROZEN' && !isStaff ? (
              <span className="text-xs text-slate-500">Contact Fraud Ops to unfreeze</span>
            ) : (
              <button
                type="button"
                onClick={() =>
                  onUpdateAccountStatus(
                    account.id,
                    account.status === 'FROZEN' ? 'ACTIVE' : 'FROZEN'
                  )
                }
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  account.status === 'FROZEN'
                    ? 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-100'
                    : 'bg-red-700 text-white hover:bg-red-800'
                }`}
              >
                {account.status === 'FROZEN' ? (
                  <>
                    <Unlock className="h-3.5 w-3.5" />
                    Unfreeze Account
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Freeze Account
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
