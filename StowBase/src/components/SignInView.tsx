import { useState, type FormEvent } from 'react';
import { Archive, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const HERO_IMAGE = '/src/assets/images/inventory_studio_shelf_1795222678286.jpg';

type AuthMode = 'login' | 'register';

export function SignInView() {
  const {
    registerWithEmail,
    loginWithEmail,
    signInWithGoogle,
    submitting,
    authError,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setLocalError(null);
    clearAuthError();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (mode === 'register') {
      if (!displayName.trim()) {
        setLocalError('Please enter your name.');
        return;
      }
      if (password.length < 8) {
        setLocalError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
      try {
        await registerWithEmail({
          displayName: displayName.trim(),
          email: email.trim(),
          password,
        });
      } catch {
        // Handled in AuthContext
      }
    } else {
      try {
        await loginWithEmail({
          email: email.trim(),
          password,
        });
      } catch {
        // Handled in AuthContext
      }
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen bg-white text-slate-900 grid lg:grid-cols-12 items-stretch">
      <div className="lg:col-span-5 flex flex-col justify-between px-8 py-8 sm:px-12 lg:px-14 border-b lg:border-b-0 lg:border-r border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
            <Archive className="w-4 h-4" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900">
            StowBase
          </span>
        </div>

        <div className="my-10 max-w-md w-full">
          <p className="text-xs font-medium tracking-wide text-blue-700 mb-2">
            Personal Inventory Workspace
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 leading-[1.18] [text-wrap:balance]">
            {mode === 'login'
              ? 'Sign in to your personal catalog.'
              : 'Create your private inventory account.'}
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
            Track belongings, storage spaces, stock levels, and movement history in real time.
          </p>

          {/* Segmented Mode Control */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="mt-6 grid grid-cols-2 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              className={`py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => switchMode('register')}
              className={`py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {displayError && (
              <div
                role="alert"
                className="px-3.5 py-2.5 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg"
              >
                {displayError}
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  autoComplete="name"
                  maxLength={80}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                maxLength={160}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={mode === 'register' ? 8 : 1}
                maxLength={128}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-confirm"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Confirm Password
                </label>
                <input
                  id="auth-confirm"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap"
            >
              <span>
                {submitting
                  ? mode === 'register'
                    ? 'Creating account...'
                    : 'Signing in...'
                  : mode === 'register'
                  ? 'Create Account'
                  : 'Sign In'}
              </span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-2.5 min-h-[44px] text-sm font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
          >
            <span>Continue with Google</span>
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Every account has isolated inventory records and exportable CSV backups.
        </p>
      </div>

      <div className="lg:col-span-7 relative bg-slate-100 min-h-[300px] lg:min-h-screen overflow-hidden">
        {!imgFailed ? (
          <img
            src={HERO_IMAGE}
            alt="Organized Scandinavian home studio wall shelf holding a vintage camera, labeled archival storage boxes, brass calipers, and hardbound books"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover lg:h-full"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-12 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500">
            <Archive className="w-12 h-12 text-slate-400 mb-3" />
            <p className="font-display text-base font-semibold text-slate-700">
              StowBase Personal Inventory
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
