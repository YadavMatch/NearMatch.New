const requiredEnv = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const readEnv = (key: string): string => {
  const value = import.meta.env[key];
  if (!value || value.startsWith('MY_') || value.startsWith('YOUR_')) {
    throw new Error(`Missing or placeholder Firebase configuration: ${key}`);
  }
  return value;
};

const firebaseConfig = {
  apiKey: readEnv('VITE_FIREBASE_API_KEY'),
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: readEnv('VITE_FIREBASE_APP_ID'),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? '',
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID ?? '(default)',
  oAuthClientId: import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID ?? '',
  recaptchaSiteKey: import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY ?? '',
};

const app = initializeApp(firebaseConfig);

// Must bind explicitly to the provisioned Firestore database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
