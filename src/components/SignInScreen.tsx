import { useEffect, useRef, useState } from 'react';
import {
  Ban, Check, Flame, Heart, IdCard, Lock, Mail, Menu, MessageCircle,
  ShieldCheck, Sparkles, Timer, UserCheck, UserPlus, Users, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEMO_PROFILES } from '../lib/demoProfiles';
import { AvatarImage } from './AvatarImage';
import { useCookieConsent } from './CookieConsentFlash';
import { NearMatchLogo } from './NearMatchLogo';
import { ScrollPageBackdrop } from './ScrollPageBackdrop';

const NAV_OPTIONS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#safety', label: 'Trust & Safety' },
  { href: '#preview', label: 'App Preview' },
] as const;

export function SignInScreen() {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInWithSocial,
    authError,
    clearAuthError,
  } = useAuth();

  const { openCookiePreferences } = useCookieConsent();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const headerRef = useRef<HTMLElement | null>(null);
  const heroCard = DEMO_PROFILES[0];
  const secondaryCards = [DEMO_PROFILES[1], DEMO_PROFILES[2]];

  useEffect(() => {
    const handleScroll = () => {
      if (!headerRef.current) return;
      if (window.scrollY > 20) {
        headerRef.current.classList.add('bg-[#FFFBF7]/90', 'backdrop-blur-md', 'shadow-sm');
      } else {
        headerRef.current.classList.remove('bg-[#FFFBF7]/90', 'backdrop-blur-md', 'shadow-sm');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      if (authMode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, displayName);
      }
      setAuthModalOpen(false);
    } catch {
      // Error handled by AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const openAuth = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    clearAuthError();
    setAuthModalOpen(true);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#FFFBF7] text-[#2C1810] font-sans selection:bg-[#F2542D] selection:text-white flex flex-col relative overflow-x-hidden">
      <ScrollPageBackdrop />
      
      {/* Header Navigation */}
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-40 transition-all duration-300 border-b border-black/5"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NearMatchLogo height={40} showWordmark={false} />
            <span className="font-extrabold text-xl sm:text-2xl tracking-tight bg-gradient-to-r from-[#2C1810] via-[#F2542D] to-[#2C1810] bg-clip-text text-transparent">
              NearMatch
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#5A4035]">
            {NAV_OPTIONS.map((opt) => (
              <a
                key={opt.href}
                href={opt.href}
                className="hover:text-[#F2542D] transition-colors cursor-pointer"
              >
                {opt.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={() => openAuth('signin')}
              className="px-5 py-2.5 rounded-full text-sm font-bold text-[#5A4035] hover:text-[#2C1810] transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="px-6 py-2.5 rounded-full text-sm font-bold bg-[#F2542D] hover:bg-[#d8431f] text-white shadow-lg shadow-[#F2542D]/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              Get Started
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-xl text-[#5A4035] hover:bg-black/5 transition-colors cursor-pointer"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden border-b border-black/5 bg-[#FFFBF7]/95 backdrop-blur-md px-4 pt-2 pb-6 flex flex-col gap-4">
            {NAV_OPTIONS.map((opt) => (
              <a
                key={opt.href}
                href={opt.href}
                onClick={() => setMenuOpen(false)}
                className="text-base font-semibold text-[#5A4035] hover:text-[#F2542D] py-1 cursor-pointer"
              >
                {opt.label}
              </a>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => openAuth('signin')}
                className="w-full py-3 rounded-2xl text-center text-sm font-bold border border-black/10 text-[#5A4035] hover:bg-black/5 transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => openAuth('signup')}
                className="w-full py-3 rounded-2xl text-center text-sm font-bold bg-[#F2542D] text-white shadow-md shadow-[#F2542D]/20 transition-colors cursor-pointer"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pt-24 pb-16">
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-16 lg:pt-16 lg:pb-24 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 flex flex-col items-start text-left gap-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F2542D]/10 border border-[#F2542D]/20 text-[#F2542D] text-xs sm:text-sm font-bold">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>Hyperlocal Proximity Dating</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#2C1810] leading-[1.1]">
              Meet matches who are <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-[#F2542D] to-[#E64A19] bg-clip-text text-transparent">
                actually near you
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-[#5A4035] font-medium max-w-xl leading-relaxed">
              Skip the endless swiping across the city. NearMatch connects you with real people in your immediate vicinity, right now.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto pt-2">
              <button
                type="button"
                onClick={() => openAuth('signup')}
                className="px-8 py-4 rounded-2xl text-base font-extrabold bg-[#F2542D] hover:bg-[#d8431f] text-white shadow-xl shadow-[#F2542D]/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer"
              >
                <span>Find Matches Near You</span>
                <Flame className="w-5 h-5 fill-current" />
              </button>
              <button
                type="button"
                onClick={() => openAuth('signin')}
                className="px-6 py-4 rounded-2xl text-base font-bold bg-black/5 hover:bg-black/10 text-[#5A4035] transition-colors flex items-center justify-center cursor-pointer"
              >
                Sign In to Account
              </button>
            </div>
            <div className="pt-6 flex items-center gap-6 text-xs sm:text-sm font-semibold text-[#8C6B5D]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#F2542D]" />
                <span>Verified Profiles</span>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-[#F2542D]" />
                <span>Real-Time Signals</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#F2542D]" />
                <span>Privacy First</span>
              </div>
            </div>
          </div>

          {/* Hero Cards Preview */}
          <div className="lg:col-span-5 relative flex justify-center items-center py-8">
            <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl border-4 border-white/80 transform rotate-1 transition-transform hover:rotate-0 duration-300">
              <AvatarImage src={heroCard.photos[0]} name={heroCard.displayName} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-extrabold text-2xl">{heroCard.displayName}, {heroCard.age}</span>
                  <UserCheck className="w-5 h-5 text-[#F2542D] fill-current" />
                </div>
                <p className="text-sm text-white/80 font-medium mb-3">{heroCard.bio}</p>
                <div className="flex items-center justify-between text-xs font-bold text-white/90 bg-white/20 backdrop-blur-md px-3 py-2 rounded-xl border border-white/20">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Nearby
                  </span>
                  <span>{heroCard.city}</span>
                </div>
              </div>
            </div>

            {/* Floating Background Card 1 */}
            <div className="absolute -top-4 -left-4 w-48 aspect-[3/4] rounded-2xl overflow-hidden shadow-lg border-2 border-white/60 transform -rotate-6 opacity-60 hidden sm:block pointer-events-none">
              <AvatarImage src={secondaryCards[0].photos[0]} name="" className="w-full h-full object-cover" />
            </div>

            {/* Floating Background Card 2 */}
            <div className="absolute -bottom-6 -right-4 w-44 aspect-[3/4] rounded-2xl overflow-hidden shadow-lg border-2 border-white/60 transform rotate-8 opacity-60 hidden sm:block pointer-events-none">
              <AvatarImage src={secondaryCards[1].photos[0]} name="" className="w-full h-full object-cover" />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 border-t border-black/5">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-extrabold text-[#2C1810]">Designed for Real Connections</h2>
            <p className="text-[#5A4035] mt-2 font-medium">Why people love NearMatch over traditional dating apps</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/60 border border-black/5 rounded-3xl p-6 sm:p-8 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-[#F2542D]/10 flex items-center justify-center text-[#F2542D]">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#2C1810]">Immediate Proximity</h3>
              <p className="text-sm text-[#5A4035] leading-relaxed">
                Connect with matches within walking distance or in your exact venue right now.
              </p>
            </div>
            <div className="bg-white/60 border border-black/5 rounded-3xl p-6 sm:p-8 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-[#F2542D]/10 flex items-center justify-center text-[#F2542D]">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#2C1810]">Instant Messaging</h3>
              <p className="text-sm text-[#5A4035] leading-relaxed">
                Start conversations right away without waiting days for mutual swipes to line up.
              </p>
            </div>
            <div className="bg-white/60 border border-black/5 rounded-3xl p-6 sm:p-8 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-[#F2542D]/10 flex items-center justify-center text-[#F2542D]">
                <Heart className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[#2C1810]">Curated Profiles</h3>
              <p className="text-sm text-[#5A4035] leading-relaxed">
                Rich profile cards highlighting real interests, verified photos, and lifestyle badges.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 border-t border-black/5">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-extrabold text-[#2C1810]">How NearMatch Works</h2>
            <p className="text-[#5A4035] mt-2 font-medium">Three simple steps to meet someone special nearby</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#F2542D] text-white font-black flex items-center justify-center text-lg shadow-md shadow-[#F2542D]/20">
                1
              </div>
              <h3 className="font-extrabold text-lg text-[#2C1810]">Create Your Profile</h3>
              <p className="text-sm text-[#5A4035]">Set up your bio, upload verified photos, and choose your match preferences in seconds.</p>
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#F2542D] text-white font-black flex items-center justify-center text-lg shadow-md shadow-[#F2542D]/20">
                2
              </div>
              <h3 className="font-extrabold text-lg text-[#2C1810]">See Nearby Singles</h3>
              <p className="text-sm text-[#5A4035]">Browse active profiles in your immediate neighborhood sorted by real proximity.</p>
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#F2542D] text-white font-black flex items-center justify-center text-lg shadow-md shadow-[#F2542D]/20">
                3
              </div>
              <h3 className="font-extrabold text-lg text-[#2C1810]">Connect & Meet Up</h3>
              <p className="text-sm text-[#5A4035]">Send a signal or message, plan a spontaneous coffee, and meet safely in public.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/5 py-12 bg-black/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-[#8C6B5D] font-medium">
          <div className="flex items-center gap-2">
            <NearMatchLogo height={24} showWordmark={false} />
            <span className="font-bold text-[#2C1810]">NearMatch</span>
            <span>&copy; {new Date().getFullYear()} NearMatch Inc. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => openCookiePreferences()}
              className="hover:text-[#F2542D] transition-colors cursor-pointer"
            >
              Cookie Preferences
            </button>
            <a href="#safety" className="hover:text-[#F2542D] transition-colors cursor-pointer">
              Safety Tips
            </a>
            <a href="#preview" className="hover:text-[#F2542D] transition-colors cursor-pointer">
              App Preview
            </a>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#FFFBF7] border border-black/10 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative flex flex-col gap-6">
            <button
              type="button"
              onClick={() => setAuthModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-[#5A4035] hover:bg-black/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center flex flex-col items-center gap-2">
              <NearMatchLogo height={48} showWordmark={false} />
              <h2 className="text-2xl font-black text-[#2C1810]">
                {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-xs text-[#8C6B5D] font-semibold">
                {authMode === 'signin' ? 'Sign in to discover matches nearby' : 'Join NearMatch to meet singles in your area'}
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <Ban className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Social Buttons Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="h-11 px-4 rounded-2xl bg-[#FFF8EC] hover:bg-[#FDE4D8] border border-[#F5C4A8] text-xs font-bold text-[#3D2817] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                  <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.3-.7-.5-1.4-.5-2.2z" />
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z" />
                </svg>
                <span>Google</span>
              </button>
              
              <button
                type="button"
                onClick={() => void signInWithSocial('Apple')}
                className="h-11 px-4 rounded-2xl bg-black hover:bg-gray-800 border border-black text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.09 2.31-.9 3.5-.92 1.83-.02 3.19.85 4 2.05-3.32 1.95-2.75 6.13.62 7.53-.78 1.96-1.78 3.51-3.2 3.51M12.03 7.25c-.15-2.23 1.66-4.07 3.72-4.25.26 2.4-2 4.35-3.72 4.25" />
                </svg>
                <span>Apple</span>
              </button>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-black/10 w-full" />
              <span className="bg-[#FFFBF7] px-3 text-[10px] font-bold text-[#8C6B5D] uppercase tracking-wider absolute">
                Or continue with email
              </span>
            </div>

            <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
              {authMode === 'signup' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#5A4035] flex items-center gap-1.5">
                    <IdCard className="w-3.5 h-3.5" />
                    <span>Display Name</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your first name"
                    className="w-full h-11 px-4 rounded-2xl bg-white border border-black/10 text-sm font-semibold text-[#2C1810] placeholder:text-black/30 focus:outline-none focus:border-[#F2542D]"
                  />
                </div>
              )}
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#5A4035] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-11 px-4 rounded-2xl bg-white border border-black/10 text-sm font-semibold text-[#2C1810] placeholder:text-black/30 focus:outline-none focus:border-[#F2542D]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#5A4035] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Password</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 rounded-2xl bg-white border border-black/10 text-sm font-semibold text-[#2C1810] placeholder:text-black/30 focus:outline-none focus:border-[#F2542D]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 mt-2 rounded-2xl bg-[#F2542D] hover:bg-[#d8431f] disabled:opacity-50 text-white font-extrabold text-sm shadow-lg shadow-[#F2542D]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <span>Processing...</span>
                ) : authMode === 'signin' ? (
                  <>
                    <span>Sign In</span>
                    <Check className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <UserPlus className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center text-xs text-[#8C6B5D] font-semibold">
              {authMode === 'signin' ? (
                <p>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => openAuth('signup')}
                    className="text-[#F2542D] font-bold hover:underline cursor-pointer"
                  >
                    Sign up
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => openAuth('signin')}
                    className="text-[#F2542D] font-bold hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
