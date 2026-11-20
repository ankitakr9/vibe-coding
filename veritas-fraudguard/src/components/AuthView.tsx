import { useState } from 'react';
import { Check, Eye, EyeOff, Lock, Shield, ShieldCheck, UserPlus } from 'lucide-react';
import type { AuthUser, UserRole } from '../shared/types';

interface AuthViewProps {
  onLogin: (email: string, password: string) => Promise<AuthUser>;
  onRegister: (input: {
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
  }) => Promise<AuthUser>;
}

const DEMO_ACCOUNTS: Array<{
  roleLabel: string;
  email: string;
  password: string;
  permissions: string;
}> = [
  {
    roleLabel: 'Administrator (ADMIN)',
    email: 'admin@veritasbank.com',
    password: 'Admin@2026!',
    permissions: 'Full monitoring, rules policy editor, RBAC user management, Java export',
  },
  {
    roleLabel: 'Fraud Analyst (ANALYST)',
    email: 'analyst@veritasbank.com',
    password: 'Analyst@2026!',
    permissions: 'Live monitoring, alert investigation notes, account freezes (rules read-only)',
  },
  {
    roleLabel: 'Bank Customer (CUSTOMER)',
    email: 'e.vance@meridianholdings.com',
    password: 'Customer@2026!',
    permissions: 'Scoped to own account alerts, transaction log, and self-freeze protection',
  },
];

export function AuthView({ onLogin, onRegister }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('admin@veritasbank.com');
  const [password, setPassword] = useState('Admin@2026!');
  const [role, setRole] = useState<UserRole>('ANALYST');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        await onRegister({ fullName, email, password, role });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPassword: string) => {
    setMode('login');
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F3F6FA] flex flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-[#DCE3EE] bg-white shadow-[0_12px_40px_rgba(11,21,40,0.08)] grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Deep Institutional Navy Column */}
        <section className="relative flex flex-col justify-between bg-[#0B1528] enterprise-grid-pattern p-8 sm:p-10 text-white lg:col-span-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1D4ED8] text-white shadow-sm">
                <Shield className="h-5 w-5" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-white">
                Veritas FraudGuard
              </span>
            </div>

            <h1 className="mt-8 text-3xl font-semibold tracking-tight text-white leading-tight">
              Enterprise Bank Fraud Operations and Real-Time Monitoring
            </h1>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              Sign in with role-scoped credentials or register a new user to access real-time transaction surveillance, hybrid rule and ML risk scoring, case triage, and the synced Java Spring Boot platform.
            </p>

            <div className="mt-8 border-t border-white/10 pt-6">
              <h2 className="text-xs font-semibold tracking-wide text-blue-300">
                Role-Based Access Control (RBAC) Directory
              </h2>
              <ul className="mt-3 divide-y divide-white/10 text-xs">
                {DEMO_ACCOUNTS.map((acct) => (
                  <li key={acct.email} className="py-3.5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{acct.roleLabel}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-blue-200/80">
                        {acct.email} · {acct.password}
                      </p>
                      <p className="mt-1 text-slate-400 leading-relaxed">{acct.permissions}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fillDemo(acct.email, acct.password)}
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
                    >
                      Fill Login
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>HMAC-SHA256 Signed JWT Sessions</span>
            <span>Salted Scrypt Hash Storage</span>
          </div>
        </section>

        {/* Right Crisp White Sign-In / Registration Column */}
        <section className="flex flex-col justify-center bg-white p-8 sm:p-10 lg:col-span-6">
          <div className="flex items-center gap-1 rounded-lg bg-[#EFF3F9] p-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white text-[#0B1528] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => {
                setMode('register');
                setEmail('');
                setPassword('');
                setError(null);
              }}
              className={`flex-1 rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white text-[#0B1528] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          <div className="mt-6">
            <h2 className="text-xl font-semibold text-slate-900">
              {mode === 'login' ? 'Sign in to Veritas FraudGuard' : 'Register a new user account'}
            </h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              {mode === 'login'
                ? 'Credentials are verified against salted hashes and issue an 8-hour signed Bearer JWT.'
                : 'Self-registration grants Bank Customer or Fraud Analyst access. Admin privileges require promotion by an existing Administrator.'}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Full Name</span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Morgan Reid"
                  className="mt-1.5 block w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 focus:outline-none"
                />
              </label>
            )}

            <label className="block">
              <span className="text-xs font-medium text-slate-700">Work or Account Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@veritasbank.com"
                className="mt-1.5 block w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">Password</span>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="block w-full rounded-lg border border-[#CBD5E1] bg-white pl-3.5 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {mode === 'register' && (
              <>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  {[
                    { ok: passwordChecks.length, label: 'At least 8 characters' },
                    { ok: passwordChecks.upper, label: 'Uppercase letter (A–Z)' },
                    { ok: passwordChecks.lower, label: 'Lowercase letter (a–z)' },
                    { ok: passwordChecks.digit, label: 'Numeric digit (0–9)' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-1.5 ${
                        item.ok ? 'text-emerald-700 font-medium' : 'text-slate-500'
                      }`}
                    >
                      <Check className={`h-3.5 w-3.5 ${item.ok ? 'opacity-100' : 'opacity-30'}`} />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                <label className="block pt-1">
                  <span className="text-xs font-medium text-slate-700">Account Access Role</span>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="mt-1.5 block w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 focus:outline-none"
                  >
                    <option value="ANALYST">Fraud Analyst (Live Monitoring &amp; Case Triage)</option>
                    <option value="CUSTOMER">Bank Customer (Personal Account Security Portal)</option>
                  </select>
                </label>
              </>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#1E40AF] disabled:opacity-60 transition-colors"
            >
              {mode === 'login' ? (
                <>
                  <Lock className="h-4 w-4" />
                  {submitting ? 'Verifying Credentials...' : 'Sign In Securely'}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  {submitting ? 'Creating Account...' : 'Create Account & Sign In'}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>Every API call and WebSocket alert stream enforces server-side RBAC.</span>
          </div>
        </section>
      </div>
    </div>
  );
}
