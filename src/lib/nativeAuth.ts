import { Capacitor } from '@capacitor/core';
import { GoogleAuthProvider, OAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

/** True inside the iOS/Android Capacitor shell, false in a normal browser. */
export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

/**
 * Google sign-in that works on both targets.
 *
 * `signInWithPopup` cannot work inside an iOS WKWebView - there is no popup
 * context - so on native we run the Google flow through the native SDK and
 * exchange the returned ID token for a Firebase credential. The plugin is
 * imported dynamically so browser builds never pull it into the bundle.
 */
export async function googleSignIn(): Promise<void> {
  if (!isNativePlatform()) {
    await signInWithPopup(auth, googleProvider);
    return;
  }

  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential?.idToken;

  if (!idToken) {
    throw new Error('Google sign-in did not return an identity token.');
  }

  await signInWithCredential(
    auth,
    GoogleAuthProvider.credential(idToken, result.credential?.accessToken ?? null),
  );
}

/** Clears the native Google session as well, so the next sign-in re-prompts. */
export async function nativeSignOutIfNeeded(): Promise<void> {
  if (!isNativePlatform()) return;
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  await FirebaseAuthentication.signOut();
}

export async function appleSignIn(): Promise<void> {
  const appleProvider = new OAuthProvider('apple.com');
  if (!isNativePlatform()) {
    await signInWithPopup(auth, appleProvider);
    return;
  }
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const result = await FirebaseAuthentication.signInWithApple();
  const idToken = result.credential?.idToken;
  if (!idToken) throw new Error('Apple sign-in did not return an identity token.');
  await signInWithCredential(auth, appleProvider.credential({ idToken, rawNonce: result.credential?.nonce }));
}
