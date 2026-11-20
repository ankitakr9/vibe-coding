import { useEffect, useState } from 'react';
import { Check, Lock, RotateCcw, Save } from 'lucide-react';
import type { FraudRuleConfig, UserRole } from '../shared/types';

interface RulesEngineViewProps {
  userRole: UserRole;
  rules: FraudRuleConfig;
  onSaveRules: (rules: FraudRuleConfig) => Promise<FraudRuleConfig>;
}

const DEFAULT_RULES: FraudRuleConfig = {
  unknownDeviceWeight: 32,
  impossibleTravelWeight: 38,
  vpnProxyWeight: 24,
  mfaFailureWeight: 35,
  invalidSessionWeight: 42,
  highAmountMultiplier: 3.0,
  highAmountWeight: 26,
  velocityBurstLimit: 3,
  velocityBurstWeight: 22,
  challengeThreshold: 40,
  blockThreshold: 68,
};

export function RulesEngineView({ userRole, rules, onSaveRules }: RulesEngineViewProps) {
  const [draft, setDraft] = useState<FraudRuleConfig>(rules);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = userRole === 'ADMIN';

  useEffect(() => {
    setDraft(rules);
  }, [rules]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveRules(draft);
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save rules');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!canEdit) return;
    setDraft(DEFAULT_RULES);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Detection Rules and Risk Thresholds
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure deterministic scoring weights and thresholds blended with the calibrated ML anomaly model. Saved values apply immediately and sync into the Java Spring Boot export.
          </p>
        </div>
      </div>

      {!canEdit && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-xs text-amber-900">
          <Lock className="h-4 w-4 shrink-0 text-amber-700" />
          <span>
            Read-only policy view. Modifying live bank fraud scoring thresholds requires the{' '}
            <strong>ADMIN</strong> role (enforced server-side via RBAC on{' '}
            <span className="font-mono">PUT /api/rules</span>).
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        <section className="rounded-xl border border-[#DCE3EE] bg-white shadow-[0_1px_2px_rgba(11,21,40,0.04)] p-6 space-y-6 lg:col-span-8">
          <div className="border-b border-[#E4E9F2] pb-4">
            <h2 className="text-base font-semibold text-[#0B1528]">Signal Risk Weights</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Points added to an incoming event score (0–100 scale) when each rule fires.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {(
              [
                {
                  key: 'invalidSessionWeight',
                  label: 'Invalid / Replayed Session Token',
                  hint: 'JWT signature mismatch or replayed anti-CSRF nonce.',
                  min: 10,
                  max: 70,
                },
                {
                  key: 'impossibleTravelWeight',
                  label: 'Impossible Geographic Travel',
                  hint: 'Haversine geo-velocity exceeding 800 km/h between logins.',
                  min: 10,
                  max: 65,
                },
                {
                  key: 'mfaFailureWeight',
                  label: 'MFA Challenge Failed or Bypassed',
                  hint: 'Rejected TOTP / passkey or missing step-up token.',
                  min: 10,
                  max: 65,
                },
                {
                  key: 'unknownDeviceWeight',
                  label: 'Unrecognized Device Fingerprint',
                  hint: 'Hardware/browser signature absent from enrolled devices.',
                  min: 10,
                  max: 60,
                },
                {
                  key: 'highAmountWeight',
                  label: 'Abnormal Monetary Volume',
                  hint: 'Transfer exceeding account 30-day average multiplier or daily limit.',
                  min: 5,
                  max: 50,
                },
                {
                  key: 'vpnProxyWeight',
                  label: 'VPN, Proxy, or Tor Exit Node',
                  hint: 'Source IP listed on anonymizer or commercial datacenter ASN.',
                  min: 5,
                  max: 50,
                },
                {
                  key: 'velocityBurstWeight',
                  label: 'Rapid Velocity Burst',
                  hint: 'Repeated transactions on one account inside a 15-minute window.',
                  min: 5,
                  max: 45,
                },
              ] as const
            ).map((field) => (
              <div key={field.key} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor={field.key} className="text-xs font-medium text-slate-800">
                    {field.label}
                  </label>
                  <span className="font-mono text-xs font-semibold tabular-nums text-blue-700">
                    +{draft[field.key]} pts
                  </span>
                </div>
                <input
                  id={field.key}
                  type="range"
                  disabled={!canEdit}
                  min={field.min}
                  max={field.max}
                  value={draft[field.key]}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))
                  }
                  className="w-full accent-[#1D4ED8] disabled:opacity-50"
                />
                <p className="text-[11px] text-slate-500">{field.hint}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 pt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">
                Anomaly Amount Multiplier (x 30-day avg)
              </span>
              <input
                type="number"
                step="0.5"
                min="1.5"
                max="10"
                disabled={!canEdit}
                value={draft.highAmountMultiplier}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    highAmountMultiplier: Math.max(1.5, Number(e.target.value) || 3),
                  }))
                }
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 focus:border-blue-600 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">
                Velocity Burst Trigger (Events / 15 min)
              </span>
              <input
                type="number"
                min="2"
                max="15"
                disabled={!canEdit}
                value={draft.velocityBurstLimit}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    velocityBurstLimit: Math.max(2, Number(e.target.value) || 3),
                  }))
                }
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 focus:border-blue-600 focus:outline-none"
              />
            </label>
          </div>
        </section>

        {/* Action Thresholds Panel */}
        <section className="rounded-xl border border-[#DCE3EE] bg-white shadow-[0_1px_2px_rgba(11,21,40,0.04)] p-6 space-y-5 lg:col-span-4">
          <div className="border-b border-[#E4E9F2] pb-4">
            <h2 className="text-base font-semibold text-[#0B1528]">Decision Thresholds</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Score cutoffs for step-up authentication and automatic unauthorized access blocking.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="challengeThreshold" className="text-xs font-medium text-slate-800">
                  Step-Up MFA Review Cutoff
                </label>
                <span className="font-mono text-xs font-semibold tabular-nums text-amber-700">
                  {draft.challengeThreshold} / 100
                </span>
              </div>
              <input
                id="challengeThreshold"
                type="range"
                disabled={!canEdit}
                min={20}
                max={65}
                value={draft.challengeThreshold}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDraft((prev) => ({
                    ...prev,
                    challengeThreshold: val,
                    blockThreshold: Math.max(prev.blockThreshold, val + 10),
                  }));
                }}
                className="w-full accent-amber-600 disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="blockThreshold" className="text-xs font-medium text-slate-800">
                  Block Unauthorized Cutoff
                </label>
                <span className="font-mono text-xs font-semibold tabular-nums text-red-700">
                  {draft.blockThreshold} / 100
                </span>
              </div>
              <input
                id="blockThreshold"
                type="range"
                disabled={!canEdit}
                min={45}
                max={95}
                value={draft.blockThreshold}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setDraft((prev) => ({
                    ...prev,
                    blockThreshold: val,
                    challengeThreshold: Math.min(prev.challengeThreshold, val - 10),
                  }));
                }}
                className="w-full accent-red-700 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="pt-2">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                style={{ width: `${draft.challengeThreshold}%` }}
                className="bg-emerald-600"
                title="Authorized range"
              />
              <div
                style={{ width: `${Math.max(0, draft.blockThreshold - draft.challengeThreshold)}%` }}
                className="bg-amber-500"
                title="Step-up MFA range"
              />
              <div
                style={{ width: `${Math.max(0, 100 - draft.blockThreshold)}%` }}
                className="bg-red-600"
                title="Blocked Unauthorized range"
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums text-slate-500">
              <span>0 Clear</span>
              <span>{draft.challengeThreshold} MFA</span>
              <span>{draft.blockThreshold} Block</span>
              <span>100</span>
            </div>
          </div>

          {canEdit && (
            <div className="border-t border-slate-200 pt-5 flex flex-col gap-2.5">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1E40AF] disabled:opacity-60 transition-colors"
              >
                {savedNotice ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saving
                  ? 'Applying Policy...'
                  : savedNotice
                    ? 'Policy Synced to Engine & Java Export'
                    : 'Save Detection Policy'}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to Baseline Defaults
              </button>
            </div>
          )}
        </section>
      </form>
    </div>
  );
}
