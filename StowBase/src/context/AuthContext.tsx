import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { setJwtToken } from '../lib/authStore';
import { authApi } from '../lib/api';
import type { AuthUser } from '../types/inventory';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  authError: string | null;
  submitting: boolean;
  clearAuthError: () => void;
  registerWithEmail: (input: {
    displayName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  loginWithEmail: (input: { email: string; password: string }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [jwtUser, setJwtUser] = useState<AuthUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setFirebaseUser({
          uid: fbUser.uid,
          email: fbUser.email ?? '',
          displayName: fbUser.displayName ?? '',
          authMethod: 'firebase',
        });
      } else {
        setFirebaseUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const registerWithEmail = async (input: {
    displayName: string;
    email: string;
    password: string;
  }) => {
    setAuthError(null);
    setSubmitting(true);
    try {
      const res = await authApi.register(input);
      setJwtToken(res.token);
      setJwtUser({
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName,
        authMethod: 'jwt',
      });
    } catch (error: unknown) {
      setAuthError(
        error instanceof Error ? error.message : 'Unable to create account.'
      );
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const loginWithEmail = async (input: { email: string; password: string }) => {
    setAuthError(null);
    setSubmitting(true);
    try {
      const res = await authApi.login(input);
      setJwtToken(res.token);
      setJwtUser({
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName,
        authMethod: 'jwt',
      });
    } catch (error: unknown) {
      setAuthError(
        error instanceof Error ? error.message : 'Invalid email or password.'
      );
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    setSubmitting(true);
    try {
      setJwtToken(null);
      setJwtUser(null);
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError(null);
      } else {
        setAuthError('Google sign-in could not be completed. Please allow popups and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const signOutUser = async () => {
    if (jwtUser) {
      await authApi.logout();
      setJwtToken(null);
      setJwtUser(null);
    }
    if (firebaseUser) {
      await signOut(auth);
      setFirebaseUser(null);
    }
  };

  const activeUser = jwtUser ?? firebaseUser;

  return (
    <AuthContext.Provider
      value={{
        user: activeUser,
        loading,
        authError,
        submitting,
        clearAuthError: () => setAuthError(null),
        registerWithEmail,
        loginWithEmail,
        signInWithGoogle,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
