import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react';
import { ApiError, bankingApi } from '../services/api';
import type { AccountType, AuthResponse } from '../types/banking';
import { validateAmountInput } from '../utils/format';

interface AuthPortalProps {
  onAuthenticated: (auth: AuthResponse, newlyCreated?: boolean) => void;
}

export function AuthPortal({ onAuthenticated }: AuthPortalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Sign-in state
  const [accountNumber, setAccountNumber] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Registration state
  const [fullName, setFullName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('Checking');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [initialDeposit, setInitialDeposit] = useState('250.00');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!accountNumber.trim() || !pin.trim()) {
      setError('Enter both your account number and PIN.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await bankingApi.login({
        accountNumber: accountNumber.trim().toUpperCase(),
        pin: pin.trim(),
      });
      onAuthenticated(result, false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 2) {
      setError('Enter your full name (at least 2 characters).');
      return;
    }
    if (newPin.trim().length < 4) {
      setError('Choose a PIN or password with at least 4 characters.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PIN confirmation does not match.');
      return;
    }
    const depositErr = validateAmountInput(initialDeposit || '0', true);
    if (depositErr) {
      setError(depositErr);
      return;
    }

    setSubmitting(true);
    try {
      const result = await bankingApi.register({
        fullName: fullName.trim(),
        accountType,
        pin: newPin.trim(),
        initialDeposit: initialDeposit.trim() || '0',
      });
      onAuthenticated(result, true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to open account right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoAccount = (acc: string, demoPin: string) => {
    setMode('login');
    setAccountNumber(acc);
    setPin(demoPin);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Alder Bank
          </span>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Capabilities
            </a>
            <a href="#demo-accounts" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Sample Accounts
            </a>
            <a href="#auth-form" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Account Access
            </a>
          </nav>
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {mode === 'login' ? 'Open Account' : 'Sign In'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          {/* Left Institutional Column */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-slate-900 text-white rounded-xl p-8 lg:p-12 relative overflow-hidden">
            {/* Subtle architectural geometric SVG lines */}
            <svg
              aria-hidden="true"
              className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none"
              viewBox="0 0 640 720"
              fill="none"
              preserveAspectRatio="xMidYMid slice"
            >
              <line x1="80" y1="0" x2="80" y2="720" stroke="white" strokeWidth="1" />
              <line x1="220" y1="0" x2="220" y2="720" stroke="white" strokeWidth="1" />
              <line x1="360" y1="0" x2="360" y2="720" stroke="white" strokeWidth="1" />
              <line x1="500" y1="0" x2="500" y2="720" stroke="white" strokeWidth="1" />
              <line x1="0" y1="160" x2="640" y2="160" stroke="white" strokeWidth="1" />
              <line x1="0" y1="360" x2="640" y2="360" stroke="white" strokeWidth="1" />
              <line x1="0" y1="540" x2="640" y2="540" stroke="white" strokeWidth="1" />
              <rect x="220" y="160" width="280" height="200" stroke="white" strokeWidth="1" />
            </svg>

            <div className="relative z-10 space-y-6">
              <p className="text-sm font-medium text-emerald-300 tracking-wide">
                Personal Ledger &amp; Core Banking Workspace
              </p>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.65rem] font-bold tracking-tight leading-[1.15] text-white max-w-xl">
                Straightforward account management with verified ledger persistence.
              </h1>
              <p className="text-slate-300 text-base leading-relaxed max-w-lg">
                Create checking or savings accounts, process deposits, withdrawals, and account transfers, run commands in the interactive console, and inspect the underlying file-based ledger or companion Core Java and JavaFX implementation.
              </p>

              <div id="features" className="pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-sm font-semibold text-white">Exact Cents Accounting</h2>
                  <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                    All deposits, withdrawals, and transfers validate decimal precision and overdraft rules on the server.
                  </p>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">GUI &amp; Scanner Console</h2>
                  <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                    Operate your account visually or through a live menu-driven terminal synced to the same persistent file.
                  </p>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Atomic File Persistence</h2>
                  <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                    Inspect live JSON ledger storage and export statements in CSV or plain-text formats.
                  </p>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Java &amp; JavaFX Companion</h2>
                  <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                    Browse and download complete Java Collections, File I/O, SQLite, and JavaFX source files inside the app.
                  </p>
                </div>
              </div>
            </div>

            <div id="demo-accounts" className="relative z-10 mt-10 pt-6 border-t border-white/10">
              <p className="text-xs font-medium text-slate-300 mb-3">
                Sample Customer Accounts for Immediate Exploration
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => fillDemoAccount('AB-1001', '1234')}
                  className="px-4 py-2 text-xs font-medium text-slate-100 bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Use AB-1001 · Elena Vance (PIN 1234)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('AB-1002', '5678')}
                  className="px-4 py-2 text-xs font-medium text-slate-100 bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Use AB-1002 · Marcus Chen (PIN 5678)
                </button>
              </div>
            </div>
          </div>

          {/* Right Form Column */}
          <div
            id="auth-form"
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-center"
          >
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-8">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Open Account
              </button>
            </div>

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-5" noValidate>
                <div>
                  <h2 className="font-display text-2xl font-semibold text-slate-900">
                    Sign in to your account
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Enter your Alder Bank account number and PIN.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="login-account"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Account Number
                    </label>
                    <input
                      id="login-account"
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="AB-1001"
                      autoComplete="username"
                      className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="login-pin"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      PIN / Password
                    </label>
                    <div className="relative">
                      <input
                        id="login-pin"
                        type={showPin ? 'text' : 'password'}
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        placeholder="Enter your PIN"
                        autoComplete="current-password"
                        className="w-full h-11 pl-3.5 pr-11 rounded-lg border border-slate-300 bg-white font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin((v) => !v)}
                        aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-700 cursor-pointer"
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
                  >
                    <span className="font-semibold">Error:</span> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 px-5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <span>{submitting ? 'Verifying credentials...' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                  <Lock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>Credentials are verified server-side with salted scrypt hashing.</span>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4" noValidate>
                <div>
                  <h2 className="font-display text-2xl font-semibold text-slate-900">
                    Open a new account
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Your account number will be generated and persisted immediately.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="reg-name"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Full Name
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jordan Patel"
                    className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700"
                  />
                </div>

                <div>
                  <span className="block text-sm font-medium text-slate-700 mb-1.5">
                    Account Type
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Checking', 'Savings'] as AccountType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setAccountType(type)}
                        className={`h-10 px-4 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                          accountType === type
                            ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="reg-pin"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      PIN / Password
                    </label>
                    <input
                      id="reg-pin"
                      type="password"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="Min 4 chars"
                      className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="reg-confirm-pin"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Confirm PIN
                    </label>
                    <input
                      id="reg-confirm-pin"
                      type="password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="Re-enter PIN"
                      className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-deposit"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Opening Deposit (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">
                      $
                    </span>
                    <input
                      id="reg-deposit"
                      type="text"
                      inputMode="decimal"
                      value={initialDeposit}
                      onChange={(e) => setInitialDeposit(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-11 pl-8 pr-3.5 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700"
                    />
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
                  >
                    <span className="font-semibold">Error:</span> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 px-5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submitting ? 'Creating account...' : 'Create Account'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
