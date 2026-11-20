import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { appleSignIn, googleSignIn, nativeSignOutIfNeeded } from '../lib/nativeAuth';
import { subscribeMyPrivateAccount, subscribeMyProfile } from '../lib/firestoreService';
import type { PrivateAccount, PublicProfile } from '../types/models';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  profile: PublicProfile | null;
  privateAccount: PrivateAccount | null;
  profileLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<void>;
  signInWithSocial: (providerName: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [privateAccount, setPrivateAccount] = useState<PrivateAccount | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setPrivateAccount(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const unsubProfile = subscribeMyProfile(
      user.uid,
      (p) => {
        setProfile(p);
        setProfileLoading(false);
      },
      (err) => {
        setAuthError(err.message);
        setProfileLoading(false);
      },
    );
    const unsubAccount = subscribeMyPrivateAccount(
      user.uid,
      (acc) => {
        setPrivateAccount(acc);
      },
      (err) => {
        setAuthError(err.message);
      },
    );

    return () => {
      unsubProfile();
      unsubAccount();
    };
  }, [user]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await googleSignIn();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to complete Google sign-in.';
      setAuthError(message);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed. Check credentials.';
      setAuthError(message);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string) => {
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      if (name && cred.user) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Account creation failed.';
      setAuthError(message);
    }
  };

  const signInWithSocial = async (providerName: string) => {
    setAuthError(null);
    if (providerName.toLowerCase() === 'apple') {
      try {
        await appleSignIn();
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : `Unable to sign in with Apple.`);
      }
      return;
    }
    if (providerName.toLowerCase() !== 'google') {
      setAuthError(`${providerName} sign-in is not configured yet. Please use Google, Apple, or email.`);
      return;
    }
    try {
      await googleSignIn();
    } catch (err) {
      const message = err instanceof Error ? err.message : `Unable to sign in with ${providerName}.`;
      setAuthError(message);
    }
  };

  const signOut = async () => {
    setAuthError(null);
    try {
      await nativeSignOutIfNeeded();
      await fbSignOut(auth);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-out failed.';
      setAuthError(message);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        profile,
        privateAccount,
        profileLoading,
        authError,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signInWithSocial,
        signOut,
        clearAuthError: () => setAuthError(null),
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
