import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import type { UserAccount, UserPrivateInfo } from '../models/types';
import { syncUserAccountOnSignIn } from '../controllers/attendanceController';

interface AuthContextValue {
  firebaseUser: User | null;
  account: UserAccount | null;
  privateInfo: UserPrivateInfo | null;
  isBootstrapAdmin: boolean;
  authReady: boolean;
  authError: string | null;
  signingIn: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshPrivateInfo: (next: UserPrivateInfo) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const isBootstrapAdmin = Boolean(
    firebaseUser?.emailVerified &&
      firebaseUser?.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
  );

  useEffect(() => {
    let unsubAccount: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubAccount) {
        unsubAccount();
        unsubAccount = null;
      }

      setFirebaseUser(user);
      setAuthError(null);

      if (!user) {
        setAccount(null);
        setPrivateInfo(null);
        setAuthReady(true);
        return;
      }

      try {
        const synced = await syncUserAccountOnSignIn(user);
        setAccount(synced.account);
        setPrivateInfo(synced.privateInfo);

        unsubAccount = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            if (snap.exists()) {
              setAccount(snap.data() as UserAccount);
            }
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
            } catch (wrapped) {
              setAuthError(
                wrapped instanceof Error ? wrapped.message : 'Unable to sync account.'
              );
            }
          }
        );
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : 'Unable to initialize your account.'
        );
      } finally {
        setAuthReady(true);
      }
    });

    return () => {
      unsubAuth();
      if (unsubAccount) unsubAccount();
    };
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in window was closed before completing authentication.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Popup was blocked by your browser. Please allow popups for this site.');
      } else {
        setAuthError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
      }
    } finally {
      setSigningIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const refreshPrivateInfo = useCallback((next: UserPrivateInfo) => {
    setPrivateInfo(next);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        account,
        privateInfo,
        isBootstrapAdmin,
        authReady,
        authError,
        signingIn,
        loginWithGoogle,
        logout,
        refreshPrivateInfo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
