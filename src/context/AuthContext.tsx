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
import { googleSignIn, nativeSignOutIfNeeded } from '../lib/nativeAuth';
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
