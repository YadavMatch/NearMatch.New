export interface CookieConsentPreferences {
  necessary: true;
  analytics: boolean;
  advertising: boolean;
  social: boolean;
  updatedAt: string;
}

export const COOKIE_CONSENT_STORAGE_KEY = 'nearmatch_cookie_consent_v1';

export const COOKIE_NOTICE_COPY =
  'We and our partners use tools to measure the audience of our website, provide you with offers and advertising tailored to your interests, and to enable interactive social platform features such as share buttons.';

export function createDefaultConsent(now = new Date()): CookieConsentPreferences {
  return {
    necessary: true,
    analytics: false,
    advertising: false,
    social: false,
    updatedAt: now.toISOString(),
  };
}

export function createAcceptAllConsent(now = new Date()): CookieConsentPreferences {
  return {
    necessary: true,
    analytics: true,
    advertising: true,
    social: true,
    updatedAt: now.toISOString(),
  };
}

export function createEssentialOnlyConsent(now = new Date()): CookieConsentPreferences {
  return {
    necessary: true,
    analytics: false,
    advertising: false,
    social: false,
    updatedAt: now.toISOString(),
  };
}

export function parseStoredConsent(raw: string | null): CookieConsentPreferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      parsed.necessary !== true ||
      typeof parsed.analytics !== 'boolean' ||
      typeof parsed.advertising !== 'boolean' ||
      typeof parsed.social !== 'boolean' ||
      typeof parsed.updatedAt !== 'string'
    ) {
      return null;
    }
    return {
      necessary: true,
      analytics: parsed.analytics,
      advertising: parsed.advertising,
      social: parsed.social,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function readStoredConsent(): CookieConsentPreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseStoredConsent(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredConsent(prefs: CookieConsentPreferences): CookieConsentPreferences {
  const normalized: CookieConsentPreferences = {
    necessary: true,
    analytics: Boolean(prefs.analytics),
    advertising: Boolean(prefs.advertising),
    social: Boolean(prefs.social),
    updatedAt: prefs.updatedAt || new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota or private-mode restrictions gracefully
    }
  }
  return normalized;
}

export function summarizeConsentStatus(prefs: CookieConsentPreferences | null): string {
  if (!prefs) return 'Not configured';
  if (prefs.analytics && prefs.advertising && prefs.social) {
    return 'All cookies accepted';
  }
  if (!prefs.analytics && !prefs.advertising && !prefs.social) {
    return 'Essential cookies only';
  }
  return 'Custom preferences';
}
