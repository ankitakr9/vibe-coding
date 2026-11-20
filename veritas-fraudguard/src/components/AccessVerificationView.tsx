import { useState } from 'react';
import { Lock, ShieldAlert, ShieldCheck, AlertTriangle, Send } from 'lucide-react';
import type {
  AccountProfile,
  AccountStatus,
  EvaluationRequest,
  EventType,
  FraudAlert,
  MfaStatus,
  TransactionRecord,
} from '../shared/types';

interface AccessVerificationViewProps {
  accounts: AccountProfile[];
  onEvaluate: (
    payload: EvaluationRequest
  ) => Promise<{ transaction: TransactionRecord; alert: FraudAlert | null }>;
  onUpdateAccountStatus: (accountId: string, status: AccountStatus) => Promise<void>;
}

interface CityOption {
  label: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  sampleIp: string;
}

const CITY_OPTIONS: CityOption[] = [
  { label: 'New York, US (Home — E. Vance)', city: 'New York', country: 'United States', lat: 40.7128, lng: -74.006, sampleIp: '72.14.198.44' },
  { label: 'Chicago, US (Home — M. Holloway)', city: 'Chicago', country: 'United States', lat: 41.8781, lng: -87.6298, sampleIp: '98.213.44.112' },
  { label: 'London, UK (Home — H. Lindqvist)', city: 'London', country: 'United Kingdom', lat: 51.5072, lng: -0.1276, sampleIp: '81.149.112.19' },
  { label: 'Austin, US (Home — C. Rojas)', city: 'Austin', country: 'United States', lat: 30.2672, lng: -97.7431, sampleIp: '70.114.88.203' },
  { label: 'Toronto, CA (Home — D. Okafor)', city: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832, sampleIp: '142.116.55.90' },
  { label: 'Lagos, Nigeria (High Geo-Shift)', city: 'Lagos', country: 'Nigeria', lat: 6.5244, lng: 3.3792, sampleIp: '102.89.33.178' },
  { label: 'Bucharest, Romania (Tor Exit)', city: 'Bucharest', country: 'Romania', lat: 44.4268, lng: 26.1025, sampleIp: '185.220.101.42' },
  { label: 'Hong Kong, China (Cross-Border)', city: 'Hong Kong', country: 'China', lat: 22.3193, lng: 114.1694, sampleIp: '45.155.205.91' },
  { label: 'Frankfurt, Germany (Datacenter ASN)', city: 'Frankfurt', country: 'Germany', lat: 50.1109, lng: 8.6821, sampleIp: '193.142.146.35' },
];

export function AccessVerificationView({
  accounts,
  onEvaluate,
  onUpdateAccountStatus,
}: AccessVerificationViewProps) {
  const defaultAccount = accounts[0];
  const [accountId, setAccountId] = useState(defaultAccount?.id ?? 'acc-101');
  const [eventType, setEventType] = useState<EventType>('WIRE_TRANSFER');
  const [amount, setAmount] = useState('16500');
  const [merchantOrTarget, setMerchantOrTarget] = useState('Offshore Clearing Account #7712');
  const [cityIndex, setCityIndex] = useState(5); // Lagos
  const [ipAddress, setIpAddress] = useState(CITY_OPTIONS[5].sampleIp);
  const [useUnknownDevice, setUseUnknownDevice] = useState(true);
  const [unknownDeviceLabel, setUnknownDeviceLabel] = useState('Unregistered Linux Chromium VM');
  const [isVpnOrTor, setIsVpnOrTor] = useState(true);
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>('FAILED');
  const [sessionTokenValid, setSessionTokenValid] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    transaction: TransactionRecord;
    alert: FraudAlert | null;
  } | null>(null);

  const selectedAccount = accounts.find((a) => a.id === accountId) ?? accounts[0];

  const applyPreset = (preset: 'legitimate' | 'hijack' | 'travel' | 'mfa_bypass') => {
    const acc = selectedAccount ?? accounts[0];
    if (!acc) return;
    const homeIdx = CITY_OPTIONS.findIndex((c) => c.city === acc.homeCity);

    if (preset === 'legitimate') {
      const idx = homeIdx >= 0 ? homeIdx : 0;
      setEventType('CARD_PAYMENT');
      setAmount(String(Math.round(acc.avgTransactionAmount * 0.45)));
      setMerchantOrTarget('Verified Local Merchant');
      setCityIndex(idx);
      setIpAddress(acc.lastIp);
      setUseUnknownDevice(false);
      setIsVpnOrTor(false);
      setMfaStatus('VERIFIED');
      setSessionTokenValid(true);
    } else if (preset === 'hijack') {
      setEventType('LOGIN_ATTEMPT');
      setAmount('0');
      setMerchantOrTarget('Online Banking Credentials Endpoint');
      setCityIndex(6); // Bucharest
      setIpAddress('185.220.101.42');
      setUseUnknownDevice(true);
      setUnknownDeviceLabel('Headless Linux Puppeteer Client');
      setIsVpnOrTor(true);
      setMfaStatus('FAILED');
      setSessionTokenValid(false);
    } else if (preset === 'travel') {
      setEventType('WIRE_TRANSFER');
      setAmount(String(Math.round(acc.avgTransactionAmount * 5.2)));
      setMerchantOrTarget('Cross-Border Crypto Liquidity Desk');
      setCityIndex(7); // Hong Kong
      setIpAddress('45.155.205.91');
      setUseUnknownDevice(true);
      setUnknownDeviceLabel('Unknown macOS Browser Fingerprint');
      setIsVpnOrTor(true);
      setMfaStatus('VERIFIED');
      setSessionTokenValid(true);
    } else if (preset === 'mfa_bypass') {
      setEventType('PASSWORD_RESET');
      setAmount('0');
      setMerchantOrTarget('Security Recovery API');
      setCityIndex(8); // Frankfurt
      setIpAddress('193.142.146.35');
      setUseUnknownDevice(true);
      setUnknownDeviceLabel('Android Emulator x86_64');
      setIsVpnOrTor(true);
      setMfaStatus('BYPASSED');
      setSessionTokenValid(false);
    }
  };

  const handleCityChange = (idx: number) => {
    setCityIndex(idx);
    setIpAddress(CITY_OPTIONS[idx].sampleIp);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    setSubmitting(true);
    try {
      const loc = CITY_OPTIONS[cityIndex];
      const trusted = selectedAccount.trustedDevices[0];
      const payload: EvaluationRequest = {
        accountId: selectedAccount.id,
        eventType,
        amount: Math.max(0, Number(amount) || 0),
        merchantOrTarget: merchantOrTarget.trim() || 'Banking Endpoint',
        ipAddress: ipAddress.trim() || loc.sampleIp,
        city: loc.city,
        country: loc.country,
        lat: loc.lat,
        lng: loc.lng,
        deviceId: useUnknownDevice ? `DEV-UNK-${Date.now().toString().slice(-4)}` : trusted.id,
        deviceLabel: useUnknownDevice ? unknownDeviceLabel.trim() || 'Unknown Device' : trusted.label,
        isVpnOrTor,
        mfaStatus,
        sessionTokenValid,
      };
      const result = await onEvaluate(payload);
      setLastResult(result);
    } finally {
      setSubmitting(false);
    }
  };

  const resultAccount = lastResult
    ? accounts.find((a) => a.id === lastResult.transaction.accountId)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0B1528]">
            Unauthorized User and Transaction Check
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Submit a live login or payment event to test device fingerprint verification, impossible travel detection, MFA integrity, and real-time alert dispatch.
          </p>
        </div>
      </div>

      {/* Interactive Scenario Presets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 mr-1">Load test scenario:</span>
        <button
          type="button"
          onClick={() => applyPreset('legitimate')}
          className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-[#1D4ED8]/40 hover:text-[#1D4ED8] hover:bg-blue-50/40 transition-colors whitespace-nowrap"
        >
          Verified Customer Purchase
        </button>
        <button
          type="button"
          onClick={() => applyPreset('hijack')}
          className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-rose-300 hover:text-rose-700 hover:bg-rose-50/40 transition-colors whitespace-nowrap"
        >
          Unauthorized Login (Tor + Replayed Token)
        </button>
        <button
          type="button"
          onClick={() => applyPreset('travel')}
          className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-amber-300 hover:text-amber-800 hover:bg-amber-50/40 transition-colors whitespace-nowrap"
        >
          Impossible Travel Wire Spike
        </button>
        <button
          type="button"
          onClick={() => applyPreset('mfa_bypass')}
          className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-rose-300 hover:text-rose-700 hover:bg-rose-50/40 transition-colors whitespace-nowrap"
        >
          MFA Bypass Password Reset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Evaluation Request Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[#DCE3EE] bg-white shadow-[0_1px_2px_rgba(11,21,40,0.04)] p-6 space-y-5 lg:col-span-7"
        >
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-semibold text-slate-900">Incoming Event Payload</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Processed server-side by the fraud scoring engine (<span className="font-mono">POST /api/evaluate</span>) and broadcast to all connected clients.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Target Bank Account</span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.holderName} ({acc.accountNumber}) — {acc.homeCity}
                    {acc.status === 'FROZEN' ? ' [FROZEN]' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">Event Type</span>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="LOGIN_ATTEMPT">Portal Sign-In Attempt</option>
                <option value="WIRE_TRANSFER">Outbound Wire Transfer</option>
                <option value="CARD_PAYMENT">Card Payment</option>
                <option value="ACH_WITHDRAWAL">ACH Withdrawal</option>
                <option value="PASSWORD_RESET">Password / MFA Recovery</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">Amount (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              {selectedAccount && (
                <span className="mt-1 block text-[11px] text-slate-500 font-mono tabular-nums">
                  Account avg: ${selectedAccount.avgTransactionAmount.toLocaleString()} · Daily limit: ${selectedAccount.dailyLimit.toLocaleString()}
                </span>
              )}
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">Counterparty or Endpoint</span>
              <input
                type="text"
                value={merchantOrTarget}
                onChange={(e) => setMerchantOrTarget(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">Origin Geolocation</span>
              <select
                value={cityIndex}
                onChange={(e) => handleCityChange(Number(e.target.value))}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {CITY_OPTIONS.map((loc, idx) => (
                  <option key={loc.label} value={idx}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">Source IP Address</span>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </label>
          </div>

          {/* Identity & Device Signals */}
          <div className="border-t border-slate-200 pt-5 space-y-4">
            <h3 className="text-xs font-semibold text-slate-900">
              Unauthorized User Verification Signals
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className="text-xs font-medium text-slate-700">Device Fingerprint</span>
                <div className="mt-1.5 flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setUseUnknownDevice(false)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      !useUnknownDevice
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Trusted Device
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseUnknownDevice(true)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      useUnknownDevice
                        ? 'bg-white text-red-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Unknown Device
                  </button>
                </div>
                {useUnknownDevice ? (
                  <input
                    type="text"
                    value={unknownDeviceLabel}
                    onChange={(e) => setUnknownDeviceLabel(e.target.value)}
                    placeholder="Device fingerprint description"
                    className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Enrolled: {selectedAccount?.trustedDevices[0]?.label}
                  </p>
                )}
              </div>

              <label className="block">
                <span className="text-xs font-medium text-slate-700">Multi-Factor Authentication (MFA)</span>
                <select
                  value={mfaStatus}
                  onChange={(e) => setMfaStatus(e.target.value as MfaStatus)}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="VERIFIED">Verified (Passkey / TOTP Matched)</option>
                  <option value="FAILED">Failed (Incorrect MFA Code)</option>
                  <option value="BYPASSED">Bypassed (Missing Step-Up Token)</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-1">
              <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isVpnOrTor}
                  onChange={(e) => setIsVpnOrTor(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                Source IP flagged as VPN, Proxy, or Tor Exit Node
              </label>

              <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={!sessionTokenValid}
                  onChange={(e) => setSessionTokenValid(!e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                Invalid or Replayed Session JWT Nonce
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#E4E9F2] pt-5">
            <span className="text-xs text-slate-500">
              High-risk verdicts emit an immediate WebSocket alert.
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#1E40AF] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Evaluating...' : 'Run Fraud & Access Check'}
            </button>
          </div>
        </form>

        {/* Instant Decision Output Panel */}
        <section className="rounded-xl border border-[#DCE3EE] bg-white shadow-[0_1px_2px_rgba(11,21,40,0.04)] p-6 lg:col-span-5">
          <h2 className="text-base font-semibold text-[#0B1528]">Real-Time Engine Verdict</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Deterministic score breakdown returned directly from the server fraud engine.
          </p>

          {!lastResult ? (
            <div className="mt-8 border-t border-slate-100 py-10 text-center">
              <ShieldCheck className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-800">Ready to inspect an event</p>
              <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
                Choose a preset scenario above or customize device, location, and MFA signals, then click Run Fraud &amp; Access Check.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {/* Verdict Header */}
              <div className="flex items-start justify-between gap-4 border-t border-b border-slate-200 py-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {lastResult.transaction.verdict === 'BLOCKED_UNAUTHORIZED' ? (
                      <>
                        <ShieldAlert className="h-5 w-5 text-red-700 shrink-0" />
                        <span className="text-red-700">Blocked — Unauthorized User</span>
                      </>
                    ) : lastResult.transaction.verdict === 'CHALLENGE_MFA' ? (
                      <>
                        <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0" />
                        <span className="text-amber-700">Hold — Step-Up MFA Required</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0" />
                        <span className="text-emerald-700">Authorized — Verified Holder</span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                    {lastResult.transaction.id}
                    {lastResult.alert ? ` · Alert ${lastResult.alert.id} dispatched` : ' · Cleared'}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Risk Score</span>
                  <span
                    className={`font-mono text-3xl font-semibold tabular-nums ${
                      lastResult.transaction.riskScore >= 68
                        ? 'text-red-700'
                        : lastResult.transaction.riskScore >= 40
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                    }`}
                  >
                    {lastResult.transaction.riskScore}
                  </span>
                </div>
              </div>

              {/* Geo-Velocity & ML Summary */}
              <dl className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <dt className="text-slate-500">ML Fraud Prob.</dt>
                  <dd className="mt-0.5 font-mono font-semibold tabular-nums text-blue-700">
                    {Math.round(lastResult.transaction.mlFraudProbability * 100)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Geo Shift</dt>
                  <dd className="mt-0.5 font-mono font-medium tabular-nums text-slate-900">
                    {lastResult.transaction.distanceFromLastKm.toLocaleString()} km
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Travel Speed</dt>
                  <dd className="mt-0.5 font-mono font-medium tabular-nums text-slate-900">
                    {lastResult.transaction.travelSpeedKmh.toLocaleString()} km/h
                  </dd>
                </div>
              </dl>

              {/* Rules Breakdown */}
              <div>
                <h3 className="text-xs font-semibold text-slate-900">
                  Evaluated Signals ({lastResult.transaction.triggeredRules.length} triggered)
                </h3>
                {lastResult.transaction.triggeredRules.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-600">
                    All checks passed: trusted device fingerprint matched, valid session token, verified MFA, and consistent location.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100 border-t border-b border-slate-200">
                    {lastResult.transaction.triggeredRules.map((rule) => (
                      <li key={rule.code} className="py-2.5">
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="font-medium text-slate-900">{rule.label}</span>
                          <span className="font-mono font-semibold tabular-nums text-red-700">
                            +{rule.scoreImpact}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-600">{rule.detail}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Instant Freeze Action if Unauthorized */}
              {resultAccount && lastResult.transaction.verdict !== 'AUTHORIZED' && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-slate-600">
                    Status:{' '}
                    <strong className={resultAccount.status === 'FROZEN' ? 'text-red-700' : 'text-slate-900'}>
                      {resultAccount.status}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateAccountStatus(
                        resultAccount.id,
                        resultAccount.status === 'FROZEN' ? 'ACTIVE' : 'FROZEN'
                      )
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                      resultAccount.status === 'FROZEN'
                        ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                        : 'bg-red-700 text-white hover:bg-red-800'
                    }`}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    {resultAccount.status === 'FROZEN' ? 'Unfreeze Account' : 'Freeze Compromised Account'}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
