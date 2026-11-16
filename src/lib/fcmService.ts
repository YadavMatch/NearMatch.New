import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission;
  token: string | null;
}

export async function checkPushSupport(): Promise<PushNotificationState> {
  const supported = await isSupported();
  const permission = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  return {
    isSupported: supported,
    permission,
    token: null,
  };
}

export async function requestPushNotificationPermission(userId?: string): Promise<string | null> {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('Firebase Cloud Messaging is not supported in this browser environment.');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Push notification permission denied or dismissed.');
      return null;
    }

    const messaging = getMessaging();
    const token = await getToken(messaging, {
      vapidKey: 'BKM2VvjS9w4p1z3K8x5L7n9Q2r4t6y8u0i1oP3a5s7d9f2g4h6j8k0l1z3x5c7v9b0n2m4'
    }).catch(() => null);

    if (token && userId) {
      try {
        await setDoc(
          doc(db, 'profiles', userId, 'private', 'info'),
          {
            fcmToken: token,
            fcmUpdatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.error('Failed to persist FCM token in Firestore:', err);
      }
    }

    return token;
  } catch (err) {
    console.error('Error requesting push notification permission:', err);
    return null;
  }
}

export function initForegroundMessaging(onAlertReceived?: (title: string, body: string) => void) {
  isSupported().then((supported) => {
    if (!supported) return;
    try {
      const messaging = getMessaging();
      onMessage(messaging, (payload) => {
        console.log('FCM Foreground Message:', payload);
        const title = payload.notification?.title || 'NearMatch Alert';
        const body = payload.notification?.body || 'You have a new update.';
        
        if (onAlertReceived) {
          onAlertReceived(title, body);
        }

        if (Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
          });
        }
      });
    } catch (err) {
      console.warn('Foreground messaging init skipped:', err);
    }
  });
}
