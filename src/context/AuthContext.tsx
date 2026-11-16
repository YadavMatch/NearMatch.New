import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
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
    let unsubProfile: (() => void) | null = null;
    let unsubPrivate: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubPrivate) {
        unsubPrivate();
        unsubPrivate = null;
      }

      setUser(firebaseUser);
      setAuthReady(true);

      if (!firebaseUser) {
        setProfile(null);
        setPrivateAccount(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      let gotProfile = false;
      let gotPrivate = false;
      const checkDone = () => {
        if (gotProfile && gotPrivate) {
          setProfileLoading(false);
        }
      };

      unsubProfile = subscribeMyProfile(
        firebaseUser.uid,
        (nextProfile) => {
          setProfile(nextProfile);
          gotProfile = true;
          checkDone();
        },
        (err) => {
          setAuthError(err.message);
          gotProfile = true;
          checkDone();
        }
      );

      unsubPrivate = subscribeMyPrivateAccount(
        firebaseUser.uid,
        (nextPrivate) => {
          setPrivateAccount(nextPrivate);
          gotPrivate = true;
          checkDone();
        },
        (err) => {
          setAuthError(err.message);
          gotPrivate = true;
          checkDone();
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubPrivate) unsubPrivate();
    };
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to complete Google sign-in.';
      setAuthError(message);
    }
  };

  const signOut = async () => {
    setAuthError(null);
    try {
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
