import { useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowLeft, ArrowRight, Check, LocateFixed, ShieldCheck } from 'lucide-react';
import {
  CITY_PRESETS,
  CONNECTION_GOALS,
  GENDER_OPTIONS,
  INTEREST_OPTIONS,
  STORY_SPARK_PROMPTS,
  VOLUMETRIC_LIMITS,
} from '../lib/constants';
import { saveOnboarding } from '../lib/firestoreService';
import { ageFromDob, jitterForPrivacy } from '../lib/matching';
import { validatePhotoGallery } from '../lib/photoGallery';
import type { ConnectionGoal, Gender } from '../types/models';
import { NearMatchLogo } from './NearMatchLogo';
import { PhotoGalleryEditor } from './PhotoGalleryEditor';

interface OnboardingFlowProps {
  user: User;
  onSignOut: () => void;
}

export function OnboardingFlow({ user, onSignOut }: OnboardingFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [displayName, setDisplayName] = useState(user.displayName?.split(' ')[0] ?? '');
  const [dob, setDob] = useState('1998-05-14');
  const [gender, setGender] = useState<Gender>('woman');
  const [interestedIn, setInterestedIn] = useState<Gender[]>(['man', 'woman']);
  const [jobTitle, setJobTitle] = useState('');
  const [bio, setBio] = useState('');
  const [connectionGoal, setConnectionGoal] = useState<ConnectionGoal>('Intentional dating');
  const [sparkQuestion, setSparkQuestion] = useState(STORY_SPARK_PROMPTS[0]);
  const [sparkAnswer, setSparkAnswer] = useState('');
  const [interests, setInterests] = useState<string[]>([
    'Specialty Coffee',
    'Indie Cinema',
    'Coastal Walks',
  ]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [city, setCity] = useState(CITY_PRESETS[0].label);
  const [rawCoords, setRawCoords] = useState<{ lat: number; lng: number }>({
    lat: CITY_PRESETS[0].lat,
    lng: CITY_PRESETS[0].lng,
  });
  const [minAge, setMinAge] = useState(21);
  const [maxAge, setMaxAge] = useState(36);
  const [maxDistanceKm, setMaxDistanceKm] = useState(35);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const computedAge = ageFromDob(dob);
  const snapped = jitterForPrivacy(rawCoords.lat, rawCoords.lng, user.uid);

  const toggleInterestedIn = (g: Gender) => {
    setInterestedIn((prev) =>
      prev.includes(g) ? (prev.length > 1 ? prev.filter((item) => item !== g) : prev) : [...prev, g]
    );
  };

  const toggleInterest = (tag: string) => {
    setInterests((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= VOLUMETRIC_LIMITS.MAX_INTERESTS) return prev;
      return [...prev, tag];
    });
  };

  const handleUseBrowserLocation = () => {
    if (!navigator.geolocation) {
      setError('Browser geolocation is unavailable. Pick a city preset below instead.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRawCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCity('Current Location');
        setLocating(false);
      },
      () => {
        setError('Location permission denied. Choose a city preset below to continue.');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const validateStep1 = (): string | null => {
    if (!displayName.trim()) return 'Please enter a display name.';
    if (computedAge === null || computedAge < 18 || computedAge > 99) {
      return 'You must be at least 18 years old to join NearMatch.';
    }
    if (interestedIn.length === 0) return 'Select at least one gender preference.';
    return null;
  };

  const validateStep2 = (): string | null => {
    const photoError = validatePhotoGallery(photos);
    if (photoError) return photoError;
    if (bio.trim().length < 10) return 'Write at least a short sentence (10+ characters) for your bio.';
    return null;
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      const msg = validateStep1();
      if (msg) {
        setError(msg);
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const msg = validateStep2();
      if (msg) {
        setError(msg);
        return;
      }
      setStep(3);
    }
  };

  const handleComplete = async () => {
    setError(null);
    const s1 = validateStep1();
    const s2 = validateStep2();
    if (s1 || s2 || computedAge === null) {
      setError(s1 ?? s2 ?? 'Invalid date of birth.');
      return;
    }

    setSaving(true);
    try {
      await saveOnboarding({
        uid: user.uid,
        email: user.email ?? '',
        displayName,
        dob,
        age: computedAge,
        gender,
        interestedIn,
        bio,
        jobTitle: jobTitle.trim() || 'Explorer',
        city: city.trim() || 'Mumbai',
        interests,
        photos,
        approxLat: snapped.approxLat,
        approxLng: snapped.approxLng,
        minAge,
        maxAge: Math.max(minAge, maxAge),
        maxDistanceKm,
        connectionGoal,
        storySparks: sparkAnswer.trim()
          ? [{ question: sparkQuestion, answer: sparkAnswer.trim() }]
          : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8EC] text-[#3D2817] flex flex-col">
      <header className="border-b border-[#F5C4A8] bg-[#FFF8EC]/95 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <NearMatchLogo height={40} wordmarkClassName="text-2xl text-[#E8603A]" />
          <button
            type="button"
            onClick={onSignOut}
            className="text-xs font-bold text-[#7A5234] hover:text-[#C44C29] cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 lg:py-12">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-8">
          {[
            { num: 1, title: 'Basics & Identity' },
            { num: 2, title: 'Photos & Story' },
            { num: 3, title: 'Privacy Location' },
          ].map((item) => {
            const active = step === item.num;
            const done = step > item.num;
            return (
              <div key={item.num} className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center ${
                    done
                      ? 'bg-[#3D8C7A] text-white'
                      : active
                      ? 'bg-[#E8603A] text-white'
                      : 'bg-[#FDE4D8] text-[#7A5234]'
                  }`}
                >
                  {done ? <Check className="w-4 h-4" /> : item.num}
                </div>
                <span
                  className={`text-xs sm:text-sm font-bold ${
                    active ? 'text-[#3D2817]' : 'text-[#9E7756]'
                  }`}
                >
                  {item.title}
                </span>
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-[#F5C4A8] rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
          {error ? (
            <div className="bg-[#FEECEB] border border-[#F5C2C0] rounded-xl px-4 py-3 text-sm font-semibold text-[#C0392B]">
              {error}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-[#3D2817]">Tell us who you are</h1>
                <p className="text-sm text-[#7A5234] mt-1">
                  Your exact date of birth stays private in your owner-only account record; only your age appears on cards.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-[#7A5234] uppercase tracking-wider mb-1.5">
                    Display name
                  </label>
                  <input
                    type="text"
                    maxLength={VOLUMETRIC_LIMITS.MAX_NAME_LEN}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="First name or nickname"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-sm font-semibold text-[#3D2817] focus:outline-none focus:border-[#E8603A] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#7A5234] uppercase tracking-wider mb-1.5">
                    Date of birth (18+ required)
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-sm font-mono text-[#3D2817] focus:outline-none focus:border-[#E8603A] focus:bg-white"
                  />
                  {computedAge !== null ? (
                    <p className="text-xs text-[#7A5234] mt-1">
                      Calculated age: <span className="font-mono font-bold">{computedAge}</span>
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7A5234] uppercase tracking-wider mb-2">
                  I identify as
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {GENDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setGender(opt.value)}
                      className={`min-h-[44px] px-3 py-2 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
                        gender === opt.value
                          ? 'bg-[#E8603A] text-white border-[#E8603A]'
                          : 'bg-[#FFF8EC] text-[#3D2817] border-[#F5C4A8] hover:bg-[#FDE4D8]/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7A5234] uppercase tracking-wider mb-2">
                  Interested in meeting
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {GENDER_OPTIONS.map((opt) => {
                    const active = interestedIn.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleInterestedIn(opt.value)}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#DCF0EA] text-[#2E6B5C] border-[#A9D7C8]'
                            : 'bg-[#FFF8EC] text-[#3D2817] border-[#F5C4A8] hover:bg-[#FDE4D8]/60'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-[#3D2817]">Upload 5–6 pictures &amp; share your vibe</h1>
                <p className="text-sm text-[#7A5234] mt-1">
                  Add at least 5 profile pictures (up to 6 max) and up to 12 interests so nearby matches get a clear view of you.
                </p>
              </div>

              <PhotoGalleryEditor photos={photos} onChange={setPhotos} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#7A5234] uppercase tracking-wider mb-1.5">
                    Role or craft
                  </label>
                  <input
                    type="text"
                    maxLength={VOLUMETRIC_LIMITS.MAX_JOB_LEN}
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Architect, Coffee Roaster"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-sm font-semibold text-[#3D2817] focus:outline-none focus:border-[#E8603A]"
                  />
                </div>
                <div className="flex items-end">
                  <p className="text-xs text-[#7A5234] pb-2">
                    Complete bios and 3+ interests boost your ranking in compatible decks.
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#7A5234] uppercase tracking-wider">
                    About you
                  </label>
                  <span className="text-[11px] font-mono text-[#9E7756]">
                    {bio.length}/{VOLUMETRIC_LIMITS.MAX_BIO_LEN}
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={VOLUMETRIC_LIMITS.MAX_BIO_LEN}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share what makes a great weekend or what you're curious about..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-sm text-[#3D2817] focus:outline-none focus:border-[#E8603A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7A5234] uppercase tracking-wider mb-2">
                  Connection Goal
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CONNECTION_GOALS.map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => setConnectionGoal(goal)}
                      className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        connectionGoal === goal
                          ? 'bg-[#3D8C7A] text-white border-[#3D8C7A]'
                          : 'bg-[#FFF8EC] text-[#3D2817] border-[#F5C4A8] hover:border-[#3D8C7A]'
                      }`}
                    >
                      {goal}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-[#FFF8EC] border border-[#F5C4A8] p-4 space-y-2.5">
                <label className="block text-xs font-bold text-[#7A5234] uppercase tracking-wider">
                  Story Spark Starter (Optional)
                </label>
                <select
                  value={sparkQuestion}
                  onChange={(e) => setSparkQuestion(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#F5C4A8] bg-white text-xs font-bold text-[#3D2817] focus:outline-none focus:border-[#E8603A]"
                >
                  {STORY_SPARK_PROMPTS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  maxLength={VOLUMETRIC_LIMITS.MAX_SPARK_ANSWER_LEN}
                  value={sparkAnswer}
                  onChange={(e) => setSparkAnswer(e.target.value)}
                  placeholder="Write a memorable short answer for matches..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#F5C4A8] bg-white text-xs font-medium text-[#3D2817] focus:outline-none focus:border-[#E8603A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7A5234] uppercase tracking-wider mb-2">
                  Interests ({interests.length}/{VOLUMETRIC_LIMITS.MAX_INTERESTS})
                </label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((tag) => {
                    const active = interests.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleInterest(tag)}
                        className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#E8603A] text-white border-[#E8603A]'
                            : 'bg-[#FFF8EC] text-[#3D2817] border-[#F5C4A8] hover:bg-[#FDE4D8]/60'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-[#3D2817]">Snapped proximity &amp; filters</h1>
                <p className="text-sm text-[#7A5234] mt-1">
                  NearMatch rounds your position to an approximate ~300m neighborhood cell before writing to Firestore.
                </p>
              </div>

              <div className="bg-[#FFF8EC] border border-[#F5C4A8] rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#3D2817]">Active Neighborhood: {city}</p>
                    <p className="text-xs font-mono text-[#2E6B5C] mt-0.5">
                      Snapped coordinates: {snapped.approxLat.toFixed(4)}, {snapped.approxLng.toFixed(4)} (~300m privacy grid)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUseBrowserLocation}
                    disabled={locating}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-[#A9D7C8] hover:bg-[#DCF0EA] text-xs font-bold text-[#2E6B5C] flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    <LocateFixed className="w-4 h-4" />
                    <span>{locating ? 'Locating...' : 'Use browser GPS'}</span>
                  </button>
                </div>

                <div>
                  <p className="text-xs font-bold text-[#7A5234] mb-2">Or pick a city preset:</p>
                  <div className="flex flex-wrap gap-2">
                    {CITY_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setCity(preset.label);
                          setRawCoords({ lat: preset.lat, lng: preset.lng });
                        }}
                        className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                          city === preset.label
                            ? 'bg-[#3D8C7A] text-white border-[#3D8C7A]'
                            : 'bg-white text-[#3D2817] border-[#F5C4A8] hover:bg-[#FDE4D8]/40'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#7A5234] mb-1.5">
                    Min age ({minAge})
                  </label>
                  <input
                    type="range"
                    min={18}
                    max={65}
                    value={minAge}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMinAge(val);
                      if (maxAge < val) setMaxAge(val);
                    }}
                    className="w-full accent-[#E8603A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#7A5234] mb-1.5">
                    Max age ({maxAge})
                  </label>
                  <input
                    type="range"
                    min={18}
                    max={80}
                    value={maxAge}
                    onChange={(e) => setMaxAge(Math.max(minAge, Number(e.target.value)))}
                    className="w-full accent-[#E8603A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#7A5234] mb-1.5">
                    Max distance ({maxDistanceKm} km)
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={200}
                    step={5}
                    value={maxDistanceKm}
                    onChange={(e) => setMaxDistanceKm(Number(e.target.value))}
                    className="w-full accent-[#3D8C7A]"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs font-medium text-[#2E6B5C] bg-[#DCF0EA] border border-[#A9D7C8] rounded-xl p-3.5">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  You can pause visibility, edit preferences, block anyone, or deactivate your account anytime from Profile.
                </span>
              </div>
            </div>
          ) : null}

          <div className="pt-4 border-t border-[#FDE4D8] flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#F5C4A8] text-sm font-bold text-[#7A5234] hover:bg-[#FFF8EC] inline-flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="min-h-[44px] px-6 py-2.5 rounded-2xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={saving}
                className="min-h-[44px] px-6 py-2.5 rounded-2xl bg-[#E8603A] hover:bg-[#C44C29] disabled:opacity-60 text-white text-sm font-bold inline-flex items-center gap-2 shadow-sm cursor-pointer"
              >
                {saving ? 'Creating profile...' : 'Start Discovering'}
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
