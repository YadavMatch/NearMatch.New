import React, { createContext, useContext, useEffect, useState } from 'react';
import { Cookie, SlidersHorizontal, X } from 'lucide-react';
import {
  COOKIE_NOTICE_COPY,
  createAcceptAllConsent,
  createDefaultConsent,
  createEssentialOnlyConsent,
  readStoredConsent,
  summarizeConsentStatus,
  writeStoredConsent,
  type CookieConsentPreferences,
} from '../lib/cookieConsent';

interface CookieConsentContextValue {
  consent: CookieConsentPreferences | null;
  consentSummary: string;
  isBannerOpen: boolean;
  isCustomizing: boolean;
  openCookiePreferences: (expandCustomize?: boolean) => void;
  closeCookiePreferences: () => void;
  acceptAllCookies: () => void;
  acceptEssentialOnly: () => void;
  saveCustomPreferences: (prefs: {
    analytics: boolean;
    advertising: boolean;
    social: boolean;
  }) => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<CookieConsentPreferences | null>(() =>
    readStoredConsent()
  );
  const [isBannerOpen, setIsBannerOpen] = useState<boolean>(() => readStoredConsent() === null);
  const [isCustomizing, setIsCustomizing] = useState(false);

  const openCookiePreferences = (expandCustomize = false) => {
    setIsCustomizing(expandCustomize);
    setIsBannerOpen(true);
  };

  const closeCookiePreferences = () => {
    if (consent !== null) {
      setIsBannerOpen(false);
      setIsCustomizing(false);
    }
  };

  const acceptAllCookies = () => {
    const saved = writeStoredConsent(createAcceptAllConsent());
    setConsent(saved);
    setIsBannerOpen(false);
    setIsCustomizing(false);
  };

  const acceptEssentialOnly = () => {
    const saved = writeStoredConsent(createEssentialOnlyConsent());
    setConsent(saved);
    setIsBannerOpen(false);
    setIsCustomizing(false);
  };

  const saveCustomPreferences = (prefs: {
    analytics: boolean;
    advertising: boolean;
    social: boolean;
  }) => {
    const saved = writeStoredConsent({
      ...createDefaultConsent(),
      analytics: prefs.analytics,
      advertising: prefs.advertising,
      social: prefs.social,
      updatedAt: new Date().toISOString(),
    });
    setConsent(saved);
    setIsBannerOpen(false);
    setIsCustomizing(false);
  };

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        consentSummary: summarizeConsentStatus(consent),
        isBannerOpen,
        isCustomizing,
        openCookiePreferences,
        closeCookiePreferences,
        acceptAllCookies,
        acceptEssentialOnly,
        saveCustomPreferences,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error('useCookieConsent must be used inside CookieConsentProvider');
  }
  return ctx;
}

export function CookieConsentFlash({ hasBottomNav = false }: { hasBottomNav?: boolean }) {
  const {
    consent,
    isBannerOpen,
    isCustomizing,
    openCookiePreferences,
    closeCookiePreferences,
    acceptAllCookies,
    acceptEssentialOnly,
    saveCustomPreferences,
  } = useCookieConsent();

  const [analytics, setAnalytics] = useState<boolean>(consent?.analytics ?? true);
  const [advertising, setAdvertising] = useState<boolean>(consent?.advertising ?? false);
  const [social, setSocial] = useState<boolean>(consent?.social ?? true);

  useEffect(() => {
    if (!isBannerOpen) return;
    setAnalytics(consent?.analytics ?? true);
    setAdvertising(consent?.advertising ?? false);
    setSocial(consent?.social ?? true);
  }, [isBannerOpen, consent]);

  useEffect(() => {
    if (!isBannerOpen || !consent) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCookiePreferences();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isBannerOpen, consent, closeCookiePreferences]);

  if (!isBannerOpen) return null;

  return (
    <aside
      role="region"
      aria-label="Cookie consent notice"
      className={`fixed inset-x-3 sm:left-auto sm:right-6 sm:w-[460px] z-50 cookie-flash-enter ${
        hasBottomNav ? 'bottom-20 lg:bottom-6' : 'bottom-4 sm:bottom-6'
      }`}
    >
      <div className="bg-[#FFF8EC]/96 backdrop-blur-md border border-[#F5C4A8] rounded-3xl shadow-[0_18px_40px_rgba(43,26,16,0.22)] p-4 sm:p-5 text-[#3D2817] space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FDE4D8] border border-[#F5C4A8] text-[#E8603A] flex items-center justify-center shrink-0">
              <Cookie className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#3D2817]">Cookie &amp; Privacy Notice</h2>
              <p className="text-[11px] font-medium text-[#7A5234]">
                Manage how NearMatch uses cookies
              </p>
            </div>
          </div>

          {consent ? (
            <button
              type="button"
              onClick={closeCookiePreferences}
              aria-label="Close cookie preferences"
              className="w-8 h-8 rounded-lg hover:bg-[#FDE4D8] text-[#7A5234] flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        <p className="text-xs sm:text-[13px] text-[#5C3D24] leading-relaxed">
          {COOKIE_NOTICE_COPY}
        </p>

        {isCustomizing ? (
          <div className="bg-white border border-[#F5C4A8] rounded-2xl p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#FDE4D8]">
              <div>
                <p className="text-xs font-bold text-[#3D2817]">Strictly Necessary</p>
                <p className="text-[11px] text-[#7A5234]">
                  Sign-in session, account security, and privacy settings.
                </p>
              </div>
              <span className="text-[11px] font-bold text-[#2E6B5C] whitespace-nowrap shrink-0">
                Always on
              </span>
            </div>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-[#3D2817]">Audience Measurement</p>
                <p className="text-[11px] text-[#7A5234]">
                  Measure website audience and feature performance.
                </p>
              </div>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="w-4 h-4 accent-[#3D8C7A] shrink-0 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-[#3D2817]">Tailored Offers &amp; Advertising</p>
                <p className="text-[11px] text-[#7A5234]">
                  Provide offers and advertising aligned with your interests.
                </p>
              </div>
              <input
                type="checkbox"
                checked={advertising}
                onChange={(e) => setAdvertising(e.target.checked)}
                className="w-4 h-4 accent-[#3D8C7A] shrink-0 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-[#3D2817]">Interactive Social Features</p>
                <p className="text-[11px] text-[#7A5234]">
                  Enable interactive social platform features such as share buttons.
                </p>
              </div>
              <input
                type="checkbox"
                checked={social}
                onChange={(e) => setSocial(e.target.checked)}
                className="w-4 h-4 accent-[#3D8C7A] shrink-0 cursor-pointer"
              />
            </label>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-0.5">
          {!isCustomizing ? (
            <button
              type="button"
              onClick={() => openCookiePreferences(true)}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#A9D7C8] bg-[#DCF0EA]/70 hover:bg-[#DCF0EA] text-[#2E6B5C] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span>Customize</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => saveCustomPreferences({ analytics, advertising, social })}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-[#A9D7C8] bg-[#DCF0EA] hover:bg-[#CBE8DF] text-[#2E6B5C] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Save Preferences
            </button>
          )}

          <button
            type="button"
            onClick={acceptEssentialOnly}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#F5C4A8] bg-white hover:bg-[#FDE4D8]/60 text-[#3D2817] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            Essential Only
          </button>

          <button
            type="button"
            onClick={acceptAllCookies}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-xs font-bold shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
          >
            Accept All
          </button>
        </div>
      </div>
    </aside>
  );
}
