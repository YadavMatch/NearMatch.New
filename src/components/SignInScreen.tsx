import { useEffect, useRef, useState } from 'react';
import {
  Ban,
  Check,
  Flame,
  Flag,
  Heart,
  IdCard,
  Lock,
  Menu,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Timer,
  UserCheck,
  X,
} from 'lucide-react';
import { DEMO_PROFILES } from '../lib/demoProfiles';
import { AvatarImage } from './AvatarImage';
import { useCookieConsent } from './CookieConsentFlash';
import { NearMatchLogo } from './NearMatchLogo';
import { ScrollPageBackdrop } from './ScrollPageBackdrop';

interface SignInScreenProps {
  onSignIn: () => void;
  authError: string | null;
  onDismissError: () => void;
}

const NAV_OPTIONS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#safety', label: 'Trust & Safety' },
  { href: '#preview', label: 'App Preview' },
] as const;

export function SignInScreen({
  onSignIn,
  authError,
  onDismissError,
}: SignInScreenProps) {
  const { openCookiePreferences } = useCookieConsent();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const heroCard = DEMO_PROFILES[0];
  const secondaryCards = [DEMO_PROFILES[1], DEMO_PROFILES[2]];

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  return (
    <div className="relative min-h-screen text-[#3D2817] flex flex-col">
      {/* Fixed Full-Page Scroll-Driven Backdrop */}
      <ScrollPageBackdrop />

      {/* Sticky Navigation with Three-Horizontal-Lines Menu */}
      <header
        ref={headerRef}
        className="sticky top-0 z-40 bg-[#FFF8EC]/92 backdrop-blur-md border-b border-[#F5C4A8]"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 relative">
          <a href="#top" className="whitespace-nowrap shrink-0">
            <NearMatchLogo height={40} wordmarkClassName="text-xl sm:text-[26px] text-[#E8603A]" />
          </a>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onSignIn}
              className="min-h-[42px] px-5 py-2 rounded-full bg-[#E8603A] hover:bg-[#C44C29] text-white text-sm font-bold shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open App
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
              className="w-11 h-11 rounded-xl border border-[#F5C4A8] bg-white hover:bg-[#FDE4D8]/70 text-[#3D2817] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {menuOpen ? (
            <nav
              aria-label="Section navigation"
              className="absolute right-4 sm:right-6 top-[68px] w-60 rounded-2xl bg-[#FFF8EC] border border-[#F5C4A8] shadow-[0_14px_32px_rgba(61,40,23,0.16)] p-2 flex flex-col gap-1 z-50"
            >
              {NAV_OPTIONS.map((opt) => (
                <a
                  key={opt.href}
                  href={opt.href}
                  onClick={() => setMenuOpen(false)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-bold text-[#3D2817] hover:bg-[#FDE4D8] hover:text-[#C44C29] flex items-center transition-colors"
                >
                  {opt.label}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="top"
        className="relative z-10 overflow-hidden text-white"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#2B1A10]/84 via-[#2B1A10]/55 to-[#2B1A10]/24"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#2B1A10]/62 via-transparent to-[#2B1A10]/36"
        />
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#A9D7C8]">
              Real Presence · Real Romance
            </p>

            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-bold leading-[1.12] tracking-tight text-balance">
              What if your favorite chapter
              <br />
              <span className="font-logo font-normal text-[#FFC98B]">starts just around the corner?</span>
            </h1>

            <p className="text-base sm:text-lg text-[#FFF8EC]/95 max-w-xl leading-relaxed">
              Forget chasing echoes miles away. NearMatch brings together people who already share your skyline, your favorite evening streets, and the quiet hope for something real — with your privacy protected until both hearts say yes.
            </p>

            <p className="max-w-lg border-l border-[#FFC98B]/50 pl-4 py-0.5 text-sm italic text-[#FFC98B]/95 leading-relaxed">
              &ldquo;Half the magic of love is timing — the other half is realizing how close they already were.&rdquo;
            </p>

            {authError ? (
              <div className="max-w-md bg-[#FEECEB] border border-[#F5C2C0] rounded-2xl p-4 flex items-start justify-between gap-3 text-[#C0392B]">
                <p className="text-sm font-semibold">{authError}</p>
                <button
                  type="button"
                  onClick={onDismissError}
                  className="text-xs font-bold underline shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 pt-1">
              <button
                type="button"
                onClick={onSignIn}
                className="min-h-[52px] px-7 py-3.5 rounded-2xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-base font-bold inline-flex items-center justify-center gap-3 shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
                  />
                </svg>
                <span>Start matching with Google</span>
              </button>

              <a
                href="#safety"
                className="min-h-[52px] px-6 py-3.5 rounded-2xl bg-white hover:bg-[#FFF8EC] text-[#2E6B5C] border border-[#A9D7C8] text-sm font-bold inline-flex items-center justify-center transition-all hover:-translate-y-0.5"
              >
                See how we keep it safe
              </a>
            </div>
          </div>

          {/* Right Phone Frame Preview */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-[300px] bg-[#FFF8EC] border-[10px] border-[#2B1A10] rounded-[42px] shadow-2xl overflow-hidden text-[#3D2817]">
              <div className="h-5 bg-[#2B1A10] w-28 mx-auto rounded-b-2xl" />
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#7A5234]">
                  <NearMatchLogo height={26} showWordmark={false} />
                  <span>Discover</span>
                  <span className="text-[#2E6B5C]">18+ Verified</span>
                </div>

                <div className="bg-white rounded-3xl border border-[#F5C4A8] overflow-hidden shadow-sm">
                  <div className="relative aspect-[4/4.3] bg-[#FDE4D8]">
                    <AvatarImage
                      src={heroCard.photos[0]}
                      name={heroCard.displayName}
                      className="w-full h-full"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2B1A10]/85 via-[#2B1A10]/35 to-transparent p-4 text-white">
                      <p className="text-[11px] font-mono text-[#A9D7C8]">
                        92% Match · 2 km away
                      </p>
                      <p className="text-lg font-bold">
                        {heroCard.displayName}, {heroCard.age}
                      </p>
                    </div>
                  </div>
                  <div className="p-3.5 space-y-2">
                    <p className="text-xs text-[#7A5234] leading-relaxed line-clamp-2">
                      {heroCard.bio}
                    </p>
                    <p className="text-[11px] font-semibold text-[#3D2817]">
                      {heroCard.interests.slice(0, 3).join(' · ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-5 pt-1 pb-2">
                  <div className="w-12 h-12 rounded-full bg-white border border-[#F5C4A8] flex items-center justify-center text-[#7A5234] shadow-sm">
                    <X className="w-5 h-5" />
                  </div>
                  <div className="w-14 h-14 rounded-full bg-[#E8603A] flex items-center justify-center text-white shadow-md">
                    <Heart className="w-6 h-6 fill-current" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get — 6 Core Features */}
      <section id="features" className="relative z-10 py-20 bg-[#FFF8EC]/76 backdrop-blur-[2px]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-14 space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2E6B5C]">
              What you get
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#3D2817] text-balance">
              Everything a modern dating app needs
            </h2>
            <p className="text-base text-[#7A5234]">
              Built on live Firebase infrastructure, not a static prototype — every feature below runs on real Firestore queries and strict security rules.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Flame,
                tone: 'coral',
                title: 'Smart discovery',
                desc: 'A candidate deck ranked by proximity decay, shared interests, age fit, and recency — automatically excluding swiped and blocked profiles.',
              },
              {
                icon: Sparkles,
                tone: 'coral',
                title: 'Real mutual matching',
                desc: 'Matches are created only when both sides record a like or super like — validated atomically in Firestore rules, never client-faked.',
              },
              {
                icon: MessageCircle,
                tone: 'coral',
                title: 'Live, real-time chat',
                desc: 'Messages land instantaneously over Firestore snapshot listeners with calendar day dividers and recipient-only read receipts.',
              },
              {
                icon: IdCard,
                tone: 'teal',
                title: 'Editorial photo profiles',
                desc: 'Choose from curated studio portraits or add your own HTTPS photo URL alongside interests, craft, and ~300m neighborhood snapping.',
              },
              {
                icon: UserCheck,
                tone: 'teal',
                title: '18+ age & identity floor',
                desc: 'Verified Google accounts and strict UTC date-of-birth validation keep private PII isolated inside owner-only subcollections.',
              },
              {
                icon: ShieldCheck,
                tone: 'teal',
                title: 'Block & report built in',
                desc: 'Every card and conversation includes one-tap safety controls — blocking is enforced directly inside Firestore security rules.',
              },
            ].map((feat) => {
              const Icon = feat.icon;
              const isCoral = feat.tone === 'coral';
              return (
                <div
                  key={feat.title}
                  className="bg-white/95 rounded-[20px] p-7 border border-[#F5C4A8] shadow-[0_2px_8px_rgba(61,40,23,0.06)] space-y-3"
                >
                  <div
                    className={`w-12 h-12 rounded-[14px] flex items-center justify-center ${
                      isCoral
                        ? 'bg-[#FDE4D8] text-[#C44C29]'
                        : 'bg-[#DCF0EA] text-[#2E6B5C]'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#3D2817]">{feat.title}</h3>
                  <p className="text-sm text-[#7A5234] leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="relative z-10 py-20 bg-white/74 backdrop-blur-[3px] border-y border-[#F5C4A8]"
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-14 space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2E6B5C]">
              How it works
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#3D2817]">
              From sign-in to first message
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                num: '1',
                title: 'Sign in with Google',
                desc: 'Authenticate with your verified Google email and confirm your 18+ date of birth.',
              },
              {
                num: '2',
                title: 'Build your profile',
                desc: 'Pick a portrait, share your bio and interests, and snap your neighborhood to ~300m.',
              },
              {
                num: '3',
                title: 'Swipe to discover',
                desc: 'Inspect transparent compatibility math and browse nearby people within your radius.',
              },
              {
                num: '4',
                title: 'Match & chat',
                desc: 'When interest is mutual, open a live conversation immediately with built-in safety.',
              },
            ].map((step) => (
              <div key={step.num} className="text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-[#E8603A] text-white font-bold flex items-center justify-center mx-auto text-base shadow-sm">
                  {step.num}
                </div>
                <h3 className="text-base font-bold text-[#3D2817]">{step.title}</h3>
                <p className="text-sm text-[#7A5234] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Safety Architecture + Rules Ledger */}
      <section id="safety" className="relative z-10 py-20 bg-[#FFF8EC]/76 backdrop-blur-[2px]">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2E6B5C]">
                Trust &amp; Safety
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#3D2817] leading-tight text-balance">
                Safety isn&apos;t a checkbox here — it&apos;s the architecture
              </h2>
              <p className="text-base text-[#7A5234]">
                Most of the engineering effort in NearMatch went into the database rules and privacy boundaries you never see directly.
              </p>
            </div>

            <ul className="space-y-5">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Explicit 18+ & PII isolation',
                  desc: 'Email, date of birth, and preference ranges live in an owner-only private subcollection — never exposed to discovery queries.',
                },
                {
                  icon: Lock,
                  title: '~300m privacy grid snapping',
                  desc: 'Browser coordinates are snapped deterministically to a ~300 meter cell before writing, protecting exact home locations.',
                },
                {
                  icon: Ban,
                  title: 'Real blocking, enforced everywhere',
                  desc: 'Blocking isn&apos;t just a UI filter — Firestore rules block swipes, match creation, and messages across any blocked pair.',
                },
                {
                  icon: Flag,
                  title: 'One-tap reporting & unmatching',
                  desc: 'Submit structured safety reports or permanently close a conversation from any profile card or chat header.',
                },
                {
                  icon: Timer,
                  title: 'Volumetric & timestamp integrity',
                  desc: 'Every document enforces strict field allowlists, size bounds, server-validated timestamps, and terminal state locks.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title} className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[#DCF0EA] text-[#2E6B5C] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#3D2817]">{item.title}</h3>
                      <p className="text-sm text-[#7A5234] leading-relaxed">{item.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="lg:col-span-5 space-y-6">
            {/* Signature Dark Espresso Rules Ledger from nearmatch.in */}
            <div className="bg-[#2B1A10] rounded-2xl p-6 text-white shadow-md">
              <p className="text-xs font-semibold text-[#C9A989] mb-3 tracking-wide">
                Active rules enforced in Firestore
              </p>
              <div className="divide-y divide-white/10 font-mono text-xs">
                {[
                  ['profiles_private_pii', 'isOwner(userId) · list: false'],
                  ['swipes_incoming_likes', 'hidden until mutual match'],
                  ['matches_atomicity', 'getAfter() reciprocal check'],
                  ['blocks_everywhere', '!isBlockedPair() in swipes + chat'],
                  ['adult_age_floor', 'age is int && age >= 18'],
                ].map(([k, v]) => (
                  <div key={k} className="py-2.5 flex items-baseline justify-between gap-4">
                    <span className="text-[#F1B896] shrink-0">{k}</span>
                    <span className="text-[#9ED6C4] text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview strip of sample community cards */}
            <div id="preview" className="grid grid-cols-2 gap-4">
              {secondaryCards.map((card) => (
                <div
                  key={card.uid}
                  className="bg-white rounded-2xl border border-[#F5C4A8] overflow-hidden shadow-sm"
                >
                  <div className="aspect-[4/4.5] bg-[#FDE4D8] relative">
                    <AvatarImage
                      src={card.photos[0]}
                      name={card.displayName}
                      className="w-full h-full"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2B1A10]/85 to-transparent p-3 text-white">
                      <p className="text-sm font-bold truncate">
                        {card.displayName}, {card.age}
                      </p>
                      <p className="text-[11px] text-white/85 truncate">{card.city}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Coral Launch CTA Banner */}
      <section className="relative z-10 pb-20 bg-[#FFF8EC]/76 backdrop-blur-[2px]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="rounded-[28px] bg-gradient-to-br from-[#E8603A]/95 to-[#C44C29]/95 p-10 sm:p-14 text-center text-white shadow-lg space-y-5">
            <div className="flex justify-center pb-1">
              <div className="inline-flex items-center justify-center rounded-3xl bg-[#FFF8EC] px-6 py-3 shadow-sm">
                <NearMatchLogo height={112} showWordmark={false} />
              </div>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-balance">
              Ready to meet people around the corner?
            </h2>
            <p className="text-base text-white/90 max-w-lg mx-auto">
              Sign in with Google to set up your NearMatch profile in under two minutes and start exploring nearby matches.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onSignIn}
                className="min-h-[50px] px-8 py-3 rounded-2xl bg-white hover:bg-[#FDE4D8] text-[#C44C29] text-base font-bold inline-flex items-center gap-2 shadow-md transition-colors cursor-pointer"
              >
                <Check className="w-5 h-5" />
                <span>Open NearMatch Web</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="relative z-10 border-t border-[#F5C4A8] py-12 bg-[#FFF8EC]/88 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 space-y-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
            <div className="space-y-4 max-w-sm">
              <NearMatchLogo height={38} wordmarkClassName="text-2xl text-[#E8603A]" />
              <p className="text-sm text-[#7A5234] leading-relaxed">
                Warm connections, just around the corner. Built with real safety at the core, not bolted on after.
              </p>

              <div className="pt-1">
                <p className="text-xs font-bold uppercase tracking-wider text-[#9E7756] mb-2.5">
                  Follow NearMatch
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href="https://www.instagram.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="NearMatch on Instagram"
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#F5C4A8] hover:border-[#E8603A] hover:bg-[#FDE4D8]/60 text-[#3D2817] hover:text-[#C44C29] text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                    </svg>
                    <span>Instagram</span>
                  </a>

                  <a
                    href="https://www.youtube.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="NearMatch on YouTube"
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#F5C4A8] hover:border-[#E8603A] hover:bg-[#FDE4D8]/60 text-[#3D2817] hover:text-[#C44C29] text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                      <path d="m10 15 5-3-5-3v6Z" />
                    </svg>
                    <span>YouTube</span>
                  </a>

                  <a
                    href="https://www.snapchat.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="NearMatch on Snapchat"
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#F5C4A8] hover:border-[#E8603A] hover:bg-[#FDE4D8]/60 text-[#3D2817] hover:text-[#C44C29] text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3c-3.1 0-5 2.2-5 5.4v1.7c-.6.2-1.4.1-1.8.4-.4.3-.2 1 .4 1.3.5.3 1.2.4 1.1 1.1-.2 1.2-1.6 2.5-3.2 3 .3.8 1.5 1.1 2.6 1.3.3.1.4.8.7 1.1.4.3 1.2.1 1.9.3.8.3 1.9 1.2 3.3 1.2s2.5-.9 3.3-1.2c.7-.2 1.5 0 1.9-.3.3-.3.4-1 .7-1.1 1.1-.2 2.3-.5 2.6-1.3-1.6-.5-3-1.8-3.2-3-.1-.7.6-.8 1.1-1.1.6-.3.8-1 .4-1.3-.4-.3-1.2-.2-1.8-.4V8.4C17 5.2 15.1 3 12 3z" />
                    </svg>
                    <span>Snapchat</span>
                  </a>

                  <a
                    href="https://www.linkedin.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="NearMatch on LinkedIn"
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#F5C4A8] hover:border-[#E8603A] hover:bg-[#FDE4D8]/60 text-[#3D2817] hover:text-[#C44C29] text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                      <rect width="4" height="12" x="2" y="9" />
                      <circle cx="4" cy="4" r="2" />
                    </svg>
                    <span>LinkedIn</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-12 text-sm">
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#9E7756]">Product</p>
                <a href="#features" className="block font-semibold text-[#7A5234] hover:text-[#E8603A]">
                  Features
                </a>
                <a href="#safety" className="block font-semibold text-[#7A5234] hover:text-[#E8603A]">
                  Trust &amp; Safety
                </a>
                <a href="#preview" className="block font-semibold text-[#7A5234] hover:text-[#E8603A]">
                  App Preview
                </a>
              </div>
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#9E7756]">Access</p>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="block font-semibold text-[#7A5234] hover:text-[#E8603A] cursor-pointer"
                >
                  Open Web App
                </button>
                <a href="#how-it-works" className="block font-semibold text-[#7A5234] hover:text-[#E8603A]">
                  How It Works
                </a>
                <button
                  type="button"
                  onClick={() => openCookiePreferences(true)}
                  className="block font-semibold text-[#7A5234] hover:text-[#E8603A] cursor-pointer"
                >
                  Cookie Preferences
                </button>
                <a
                  href="/privacy.html"
                  className="block font-semibold text-[#7A5234] hover:text-[#E8603A]"
                >
                  Privacy Policy
                </a>
                <a href="/terms.html" className="block font-semibold text-[#7A5234] hover:text-[#E8603A]">
                  Terms of Service
                </a>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#F5C4A8] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#9E7756]">
            <span>© 2026 NearMatch. All rights reserved.</span>
            <span>Made for people who want dating apps to take safety seriously.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
