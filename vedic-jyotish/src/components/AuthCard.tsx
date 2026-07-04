import React, { useState } from 'react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from '../firebase';
import { User, Lock, Mail, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

interface AuthCardProps {
  onAuthSuccess: (user: any) => void;
  onContinueAsGuest: () => void;
}

export default function AuthCard({ onAuthSuccess, onContinueAsGuest }: AuthCardProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      setError("Authentication is temporarily unavailable.");
      return;
    }
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        onAuthSuccess(userCredential.user);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // We can add more info if needed, but for now successful registration is enough
        onAuthSuccess(userCredential.user);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email is already registered.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters long.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password authentication is currently not enabled in the Firebase Console. Please ask the developer/administrator to enable "Email/Password" provider in the Firebase Console under Build > Authentication > Sign-in method, or log in instantly using Google Sign-In below.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!auth) {
      setError("Authentication is temporarily unavailable.");
      return;
    }
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      onAuthSuccess(userCredential.user);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Google Sign-In is not enabled. Please enable "Google" under Firebase Console > Build > Authentication > Sign-in method.');
      } else {
        setError(err.message || 'Google authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInstantSignIn = async () => {
    if (!auth) {
      setError("Authentication is temporarily unavailable.");
      return;
    }
    setError('');
    setLoading(true);
    const testEmail = 'astro.seeker@vedicjyotish.com';
    const testPassword = 'CosmicAlignment777';
    try {
      // Attempt login
      const userCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);
      onAuthSuccess(userCredential.user);
    } catch (err: any) {
      console.log("Instant sign-in: attempting registration...", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
          onAuthSuccess(userCredential.user);
        } catch (regErr: any) {
          console.error("Instant registration failed, falling back to Guest:", regErr);
          onContinueAsGuest();
        }
      } else {
        console.error("Instant login failed, falling back to Guest:", err);
        onContinueAsGuest();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-card-component" className="w-full max-w-md bg-[#13131a] rounded-3xl border border-gold-900/50 p-8 shadow-2xl relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-saffron-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-saffron-600 to-gold-400 flex items-center justify-center shadow-lg shadow-saffron-900/30 mb-4 animate-pulse">
          <Sparkles className="w-8 h-8 text-neutral-950 stroke-[2]" />
        </div>
        <h2 className="text-2xl font-display font-bold tracking-wider text-gold-100">
          {isLogin ? 'Login to Janam Patrika' : 'Create Astro Account'}
        </h2>
        <p className="text-xs text-neutral-400 mt-2 max-w-xs">
          Unlock personalized Nakshatra alignments, saved birth charts, and guidance from Acharya Shastri.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-950/40 border border-red-800 text-red-300 rounded-xl text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <label className="block text-xs font-medium text-gold-300 mb-1.5 ml-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                id="auth-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Acharya Sharma"
                className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-gold-500 transition"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gold-300 mb-1.5 ml-1">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seeker@cosmos.com"
              className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-gold-500 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gold-300 mb-1.5 ml-1">Secret Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              id="auth-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-gold-500 transition"
            />
          </div>
        </div>

        <button
          id="btn-auth-submit"
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-saffron-600 to-gold-500 hover:from-saffron-500 hover:to-gold-400 text-neutral-950 font-bold py-3 px-4 rounded-xl text-sm transition shadow-lg shadow-saffron-900/20 active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Syncing Alignment...
            </>
          ) : isLogin ? (
            'Access Your Chart'
          ) : (
            'Register Astrological Profile'
          )}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-4 text-xs">
        <button
          id="btn-toggle-auth-mode"
          onClick={() => setIsLogin(!isLogin)}
          className="text-gold-400 hover:text-gold-300 font-semibold underline underline-offset-4"
        >
          {isLogin ? "New seeker? Register here" : "Already registered? Login here"}
        </button>

        <div className="w-full flex items-center gap-3 py-1">
          <div className="h-[1px] bg-neutral-800 grow" />
          <span className="text-neutral-500 font-mono text-[10px]">OR</span>
          <div className="h-[1px] bg-neutral-800 grow" />
        </div>

        <button
          id="btn-instant-auth"
          type="button"
          onClick={handleInstantSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-gold-400 hover:from-amber-400 hover:to-gold-300 text-neutral-950 font-bold py-2.5 px-4 rounded-xl text-sm transition active:scale-[0.98] border border-gold-400/20 shadow-lg shadow-gold-500/5"
        >
          <Sparkles className="w-4 h-4 text-neutral-950 stroke-[2] animate-pulse" />
          One-Click Instant Sign-In
        </button>

        <button
          id="btn-google-auth"
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-[#1b1b24] hover:bg-[#252533] border border-neutral-800 text-neutral-300 font-semibold py-2.5 px-4 rounded-xl text-sm transition active:scale-[0.98]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        <button
          id="btn-guest-continue"
          onClick={onContinueAsGuest}
          className="text-neutral-400 hover:text-white flex items-center gap-1.5 px-4 py-2 border border-neutral-800 rounded-xl hover:bg-neutral-900 transition"
        >
          Continue as Guest Seeker
        </button>
      </div>
    </div>
  );
}
