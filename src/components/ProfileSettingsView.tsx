import { useEffect, useState } from 'react';
import {
  Ban,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  Cookie,
  Eye,
  IdCard,
  Images,
  LocateFixed,
  PauseCircle,
  PlayCircle,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserCheck,
  UserRound,
  X,
} from 'lucide-react';
import {
  CITY_PRESETS,
  CONNECTION_GOALS,
  GENDER_OPTIONS,
  INTEREST_OPTIONS,
  PORTRAIT_PRESETS,
  STORY_SPARK_PROMPTS,
  VOLUMETRIC_LIMITS,
} from '../lib/constants';
import { requestPushNotificationPermission } from '../lib/fcmService';
import {
  deactivateAccount,
  unblockUser,
  updateDiscoveryPreferences,
  updateProfileDetails,
} from '../lib/firestoreService';
import { getVerificationStatus } from '../lib/identityVerification';
import { jitterForPrivacy, profileCompleteness } from '../lib/matching';
import { havePhotosChanged, validatePhotoGallery } from '../lib/photoGallery';
import type {
  BlockRecord,
  ConnectionGoal,
  Gender,
  PrivateAccount,
  PublicProfile,
  StorySpark,
} from '../types/models';
import { AvatarImage } from './AvatarImage';
import { useCookieConsent } from './CookieConsentFlash';
import type { VerificationTab } from './IdentityVerificationModal';
import { PhotoGalleryEditor } from './PhotoGalleryEditor';
import { ConfirmActionModal, ProfileDetailModal, SafetyTipsModal } from './SafetyModals';

export type ProfileSection = 'about' | 'photos' | 'preferences' | 'safety';

interface ProfileSettingsViewProps {
  profile: PublicProfile;
  privateAccount: PrivateAccount;
  blocks: BlockRecord[];
  initialSection?: ProfileSection;
  onSectionChange?: (section: ProfileSection) => void;
  onOpenVerification: (tab: VerificationTab) => void;
  onSignOut: () => void;
}

export function ProfileSettingsView({
  profile,
  privateAccount,
  blocks,
  initialSection = 'about',
  onSectionChange,
  onOpenVerification,
  onSignOut,
}: ProfileSettingsViewProps) {
  const { consentSummary, openCookiePreferences } = useCookieConsent();

  const [activeSection, setActiveSection] = useState<ProfileSection>(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const selectSection = (section: ProfileSection) => {
    setActiveSection(section);
    onSectionChange?.(section);
  };

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [gender, setGender] = useState<Gender>(profile.gender);
  const [interestedIn, setInterestedIn] = useState<Gender[]>(profile.interestedIn);
  const [jobTitle, setJobTitle] = useState(profile.jobTitle);
  const [bio, setBio] = useState(profile.bio);
  const [connectionGoal, setConnectionGoal] = useState<ConnectionGoal>(
    profile.connectionGoal ?? 'Intentional dating'
  );
  const [storySparks, setStorySparks] = useState<StorySpark[]>(
    profile.storySparks && profile.storySparks.length > 0 ? profile.storySparks : []
  );
  const [interests, setInterests] = useState<string[]>(profile.interests);
  const [photos, setPhotos] = useState<string[]>(profile.photos);
  const [city, setCity] = useState(profile.city);
  const [coords, setCoords] = useState({ lat: profile.approxLat, lng: profile.approxLng });

  const [minAge, setMinAge] = useState(privateAccount.minAge);
  const [maxAge, setMaxAge] = useState(privateAccount.maxAge);
  const [maxDistanceKm, setMaxDistanceKm] = useState(privateAccount.maxDistanceKm);
  const [strictAgeBoundary, setStrictAgeBoundary] = useState(
    Boolean(privateAccount.strictAgeBoundary)
  );
  const [strictDistanceBoundary, setStrictDistanceBoundary] = useState(
    Boolean(privateAccount.strictDistanceBoundary)
  );
  const [showMe, setShowMe] = useState(profile.isVisible);

  const verificationStatus = getVerificationStatus(profile, privateAccount);

  const [fcmLoading, setFcmLoading] = useState(false);
  const [fcmNotice, setFcmNotice] = useState<string | null>(null);
  const [fcmEnabled, setFcmEnabled] = useState(Boolean((privateAccount as any).fcmToken));

  const handleEnablePush = async () => {
    setFcmLoading(true);
    setFcmNotice(null);
    try {
      const token = await requestPushNotificationPermission(profile.uid);
      if (token) {
        setFcmEnabled(true);
        setFcmNotice('Push notifications successfully enabled!');
      } else {
        setFcmNotice('Permission denied or FCM not supported in this browser.');
      }
    } catch {
      setFcmNotice('Failed to enable push notifications.');
    } finally {
      setFcmLoading(false);
    }
  };
  const photosChanged = havePhotosChanged(profile.photos, photos);
  const photosBelowMinimum = photos.length < VOLUMETRIC_LIMITS.MIN_PHOTOS;

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [locating, setLocating] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );
  const [showCardPreview, setShowCardPreview] = useState(false);
  const [showSafetyTipsModal, setShowSafetyTipsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const completeness = Math.round(profileCompleteness(profile) * 100);

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

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setFeedback({ kind: 'error', text: 'Geolocation is unavailable in this browser.' });
      return;
    }
    setLocating(true);
    setFeedback(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const snapped = jitterForPrivacy(pos.coords.latitude, pos.coords.longitude, profile.uid);
        setCoords({ lat: snapped.approxLat, lng: snapped.approxLng });
        setCity('Current Location');
        setLocating(false);
      },
      () => {
        setFeedback({
          kind: 'error',
          text: 'Location permission denied. Pick a neighborhood preset instead.',
        });
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleSaveProfile = async () => {
    const cleanName = displayName.trim();
    if (!cleanName) {
      setFeedback({ kind: 'error', text: 'Display name cannot be empty.' });
      return;
    }
    const photoError = validatePhotoGallery(photos);
    if (photoError) {
      setFeedback({ kind: 'error', text: photoError });
      selectSection('photos');
      return;
    }
    setSavingProfile(true);
    setFeedback(null);
    const snapped = jitterForPrivacy(coords.lat, coords.lng, profile.uid);
    try {
      const result = await updateProfileDetails(profile.uid, {
        displayName: cleanName,
        gender,
        interestedIn,
        bio,
        jobTitle,
        city,
        interests,
        photos,
        previousPhotos: profile.photos,
        approxLat: snapped.approxLat,
        approxLng: snapped.approxLng,
        connectionGoal,
        storySparks,
      });
      if (result.photosChanged) {
        setFeedback({
          kind: 'success',
          text: 'Pictures updated. Complete both Selfie Verification and Age Verification to restore verified chat access.',
        });
        onOpenVerification('selfie');
      } else {
        setFeedback({ kind: 'success', text: 'Profile details saved.' });
      }
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Unable to save profile.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    setFeedback(null);
    try {
      await updateDiscoveryPreferences(profile.uid, {
        minAge,
        maxAge: Math.max(minAge, maxAge),
        maxDistanceKm,
        showMe,
        interestedIn,
        strictAgeBoundary,
        strictDistanceBoundary,
      });
      setFeedback({ kind: 'success', text: 'Match preferences updated.' });
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Unable to update preferences.',
      });
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleDeactivate = async () => {
    setDeleting(true);
    try {
      await deactivateAccount(profile.uid);
      setShowDeleteModal(false);
      onSignOut();
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not deactivate account.',
      });
      setDeleting(false);
    }
  };

  const handleQuickVisibilityToggle = async () => {
    if (togglingVisibility) return;
    const nextVisible = !showMe;
    setTogglingVisibility(true);
    setFeedback(null);
    try {
      await updateDiscoveryPreferences(profile.uid, {
        minAge,
        maxAge: Math.max(minAge, maxAge),
        maxDistanceKm,
        showMe: nextVisible,
        interestedIn,
        strictAgeBoundary,
        strictDistanceBoundary,
      });
      setShowMe(nextVisible);
      setFeedback({
        kind: 'success',
        text: nextVisible
          ? 'Discovery resumed — your card is visible nearby.'
          : 'Discovery paused — your card is hidden from new picks.',
      });
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Unable to update visibility.',
      });
    } finally {
      setTogglingVisibility(false);
    }
  };

  const previewProfileSnapshot: PublicProfile = {
    ...profile,
    displayName: displayName.trim() || profile.displayName,
    jobTitle: jobTitle.trim() || profile.jobTitle,
    bio: bio.trim(),
    city: city.trim() || profile.city,
    interests,
    connectionGoal,
    storySparks: storySparks.filter((s) => s.question.trim() && s.answer.trim()),
    photos:
      photos.length > 0
        ? photos
        : profile.photos.length > 0
        ? profile.photos
        : [PORTRAIT_PRESETS[0].url],
    approxLat: coords.lat,
    approxLng: coords.lng,
  };

  const verificationBadgeText = verificationStatus.needsVerificationToChat
    ? verificationStatus.reason === 'photo_change'
      ? 'Re-verification required'
      : verificationStatus.reason === 'security_check'
      ? 'Security check due'
      : 'Verification pending'
    : 'Identity & Selfie Verified';

  const navSections: {
    id: ProfileSection;
    label: string;
    subtitle: string;
    icon: typeof UserRound;
    alert?: string;
  }[] = [
    {
      id: 'about',
      label: 'Profile & Bio',
      subtitle: 'Name, bio, sparks, interests, area',
      icon: UserRound,
    },
    {
      id: 'photos',
      label: 'Photos',
      subtitle: `${photos.length}/${VOLUMETRIC_LIMITS.MAX_PHOTOS} pictures (${VOLUMETRIC_LIMITS.MIN_PHOTOS} min)`,
      icon: Images,
      alert: photosBelowMinimum
        ? `Need ${VOLUMETRIC_LIMITS.MIN_PHOTOS - photos.length}`
        : photosChanged
        ? 'Unsaved'
        : undefined,
    },
    {
      id: 'preferences',
      label: 'Match Preferences',
      subtitle: `Ages ${minAge}–${maxAge} · ${maxDistanceKm} km`,
      icon: SlidersHorizontal,
    },
    {
      id: 'safety',
      label: 'Safety & Account',
      subtitle: `${verificationBadgeText} · ${blocks.length} blocked`,
      icon: ShieldCheck,
      alert: verificationStatus.needsVerificationToChat ? 'Action needed' : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Profile Header Summary */}
      <section className="bg-white border border-[#F5C4A8] rounded-3xl p-5 sm:p-6 shadow-[0_2px_8px_rgba(61,40,23,0.06)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <AvatarImage
              src={photos[0] ?? profile.photos[0] ?? PORTRAIT_PRESETS[0].url}
              name={displayName}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shrink-0 border border-[#F5C4A8]"
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h1 className="text-xl sm:text-2xl font-bold text-[#3D2817] truncate">
                  {displayName || profile.displayName}, {profile.age}
                </h1>
                <span className="text-xs font-mono font-bold text-[#2E6B5C] tabular-nums">
                  {completeness}% complete
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#7A5234]">
                <span>{jobTitle || profile.jobTitle || 'NearMatch Member'}</span>
                <span aria-hidden="true">·</span>
                <span>{city}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{privateAccount.email}</span>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span
                  className={
                    verificationStatus.needsVerificationToChat
                      ? 'text-[#C44C29] font-bold'
                      : 'text-[#2E6B5C] font-bold'
                  }
                >
                  {verificationBadgeText}
                </span>
                <span aria-hidden="true" className="text-[#9E7756]">
                  ·
                </span>
                <span className="text-[#7A5234]">
                  {showMe ? 'Visible in Discovery' : 'Discovery Paused'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowCardPreview(true)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FFF8EC] hover:bg-[#FDE4D8]/60 border border-[#F5C4A8] text-xs font-bold text-[#3D2817] inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
            >
              <Eye className="w-4 h-4 text-[#E8603A] shrink-0" />
              <span>Preview Card</span>
            </button>

            <button
              type="button"
              disabled={togglingVisibility}
              onClick={() => void handleQuickVisibilityToggle()}
              className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60 transition-colors ${
                showMe
                  ? 'bg-white hover:bg-[#FFF8EC] border-[#F5C4A8] text-[#7A5234]'
                  : 'bg-[#DCF0EA] hover:bg-[#CBE8DF] border-[#A9D7C8] text-[#2E6B5C]'
              }`}
            >
              {showMe ? (
                <>
                  <PauseCircle className="w-4 h-4 text-[#E8603A] shrink-0" />
                  <span>{togglingVisibility ? 'Updating...' : 'Pause Discovery'}</span>
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 text-[#2E6B5C] shrink-0" />
                  <span>{togglingVisibility ? 'Updating...' : 'Resume Discovery'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Profile Completeness Bar */}
        <div className="mt-4 pt-3.5 border-t border-[#FDE4D8] flex items-center gap-3">
          <span className="text-[11px] font-bold text-[#7A5234] whitespace-nowrap">
            Card readiness
          </span>
          <div className="flex-1 h-2 rounded-full bg-[#FFF8EC] border border-[#FDE4D8] overflow-hidden">
            <div
              className="h-full bg-[#3D8C7A] rounded-full transition-all"
              style={{ width: `${completeness}%` }}
            />
          </div>
          <span className="text-[11px] font-mono font-bold text-[#2E6B5C] tabular-nums shrink-0">
            {completeness}%
          </span>
        </div>
      </section>

      {/* Actionable Verification Alert Banner (only shown when verification action is pending) */}
      {verificationStatus.needsVerificationToChat ? (
        <div className="rounded-2xl bg-[#FDE4D8]/85 border border-[#E8603A] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-[#C44C29] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-bold text-[#3D2817]">
                {verificationStatus.reason === 'photo_change'
                  ? 'Photo Security Re-Verification Required'
                  : verificationStatus.reason === 'security_check'
                  ? 'Periodic Security Check Pending'
                  : 'Complete Verification to Unlock Messaging'}
              </p>
              <p className="text-xs text-[#7A5234] leading-relaxed">
                {verificationStatus.reason === 'photo_change'
                  ? 'Your profile pictures were updated. Complete both Live Selfie Verification and Age Verification (18+ ID) to restore verified chat access.'
                  : verificationStatus.reason === 'security_check'
                  ? 'Run a quick live camera selfie check to keep your verified chat status active.'
                  : 'Complete Age & Real ID Verification and Live Selfie Verification once so you can chat as soon as you match.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!verificationStatus.isProfileVerified ? (
              <button
                type="button"
                onClick={() => onOpenVerification('profile_id')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <IdCard className="w-3.5 h-3.5 shrink-0" />
                <span>Age &amp; ID Verification</span>
              </button>
            ) : null}
            {!verificationStatus.isSelfieVerified || verificationStatus.securityCheckPending ? (
              <button
                type="button"
                onClick={() => onOpenVerification('selfie')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#3D8C7A] hover:bg-[#2E6B5C] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 shrink-0" />
                <span>Selfie Verification</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Global Save / Action Feedback Banner */}
      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 border flex items-center justify-between gap-3 text-xs font-bold ${
            feedback.kind === 'error'
              ? 'bg-[#FEECEB] border-[#F5C2C0] text-[#C0392B]'
              : 'bg-[#DCF0EA] border-[#A9D7C8] text-[#2E6B5C]'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss status message"
            className="w-7 h-7 rounded-lg hover:bg-black/5 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      {/* Organized Two-Zone Workspace: Clear Section Navigation + Focused Active Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Section Navigation Rail */}
        <aside className="lg:col-span-4 xl:col-span-3" aria-label="Profile sections">
          <div className="bg-white border border-[#F5C4A8] rounded-3xl p-2.5 shadow-[0_2px_8px_rgba(61,40,23,0.06)] grid grid-cols-2 lg:grid-cols-1 gap-1.5">
            {navSections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => selectSection(sec.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`min-h-[54px] w-full px-3.5 py-2.5 rounded-2xl text-left flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#E8603A] text-white shadow-xs'
                      : 'bg-transparent hover:bg-[#FFF8EC] text-[#3D2817]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-[#E8603A]'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold truncate">{sec.label}</p>
                      <p
                        className={`text-[11px] truncate hidden lg:block ${
                          isActive ? 'text-white/85' : 'text-[#7A5234]'
                        }`}
                      >
                        {sec.subtitle}
                      </p>
                    </div>
                  </div>
                  {sec.alert ? (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-lg whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-[#FDE4D8] text-[#C44C29]'
                      }`}
                    >
                      {sec.alert}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Active Section Workspace */}
        <section className="lg:col-span-8 xl:col-span-9 bg-white border border-[#F5C4A8] rounded-3xl p-6 sm:p-8 shadow-[0_2px_8px_rgba(61,40,23,0.06)]">
          {/* SECTION 1: PROFILE & BIO */}
          {activeSection === 'about' ? (
            <div className="space-y-7">
              <div className="pb-4 border-b border-[#FDE4D8]">
                <h2 className="text-2xl font-bold text-[#3D2817]">Profile &amp; Bio</h2>
                <p className="text-sm text-[#7A5234] mt-0.5">
                  Personal details, conversation prompts, interests, and your neighborhood area shown on your card.
                </p>
              </div>

              {/* Group A: Basics */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#3D2817]">1. Basic Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="profile-display-name"
                      className="block text-xs font-bold text-[#7A5234] mb-1.5"
                    >
                      Display name
                    </label>
                    <input
                      id="profile-display-name"
                      type="text"
                      maxLength={VOLUMETRIC_LIMITS.MAX_NAME_LEN}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-sm font-semibold text-[#3D2817] focus:outline-none focus:border-[#E8603A] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-job-title"
                      className="block text-xs font-bold text-[#7A5234] mb-1.5"
                    >
                      Role or craft
                    </label>
                    <input
                      id="profile-job-title"
                      type="text"
                      maxLength={VOLUMETRIC_LIMITS.MAX_JOB_LEN}
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-sm font-semibold text-[#3D2817] focus:outline-none focus:border-[#E8603A] focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1.5">
                    <label
                      htmlFor="profile-bio"
                      className="text-xs font-bold text-[#7A5234]"
                    >
                      About you (Bio)
                    </label>
                    <span className="text-[11px] font-mono text-[#9E7756] tabular-nums">
                      {bio.length}/{VOLUMETRIC_LIMITS.MAX_BIO_LEN}
                    </span>
                  </div>
                  <textarea
                    id="profile-bio"
                    rows={3}
                    maxLength={VOLUMETRIC_LIMITS.MAX_BIO_LEN}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Share a quick snapshot of how you spend weekends or what you are looking forward to..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-sm text-[#3D2817] focus:outline-none focus:border-[#E8603A] focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <span className="block text-xs font-bold text-[#7A5234] mb-2">
                      I identify as
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {GENDER_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setGender(opt.value)}
                          className={`min-h-[42px] px-3 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                            gender === opt.value
                              ? 'bg-[#E8603A] text-white border-[#E8603A]'
                              : 'bg-[#FFF8EC] text-[#3D2817] border-[#F5C4A8] hover:border-[#E8603A]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-bold text-[#7A5234] mb-2">
                      Looking for
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {CONNECTION_GOALS.map((goal) => {
                        const active = connectionGoal === goal;
                        return (
                          <button
                            key={goal}
                            type="button"
                            onClick={() => setConnectionGoal(goal)}
                            className={`min-h-[42px] px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#3D8C7A] text-white border-[#3D8C7A]'
                                : 'bg-[#FFF8EC] text-[#3D2817] border-[#F5C4A8] hover:border-[#3D8C7A]'
                            }`}
                          >
                            {goal}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Group B: Story Sparks */}
              <div className="pt-6 border-t border-[#FDE4D8] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#3D2817] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#E8603A]" />
                      <span>
                        2. Story Sparks ({storySparks.length}/{VOLUMETRIC_LIMITS.MAX_SPARKS})
                      </span>
                    </h3>
                    <p className="text-xs text-[#7A5234] mt-0.5">
                      Short conversation prompts shown on your discovery card.
                    </p>
                  </div>
                  {storySparks.length < VOLUMETRIC_LIMITS.MAX_SPARKS ? (
                    <button
                      type="button"
                      onClick={() =>
                        setStorySparks((prev) => [
                          ...prev,
                          {
                            question:
                              STORY_SPARK_PROMPTS[prev.length % STORY_SPARK_PROMPTS.length],
                            answer: '',
                          },
                        ])
                      }
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] hover:border-[#E8603A] text-xs font-bold text-[#C44C29] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Story Spark</span>
                    </button>
                  ) : null}
                </div>

                {storySparks.length === 0 ? (
                  <p className="text-xs text-[#7A5234] bg-[#FFF8EC] border border-[#F5C4A8] rounded-2xl p-4">
                    Add up to 3 conversation-starting Story Sparks so matches have an easy opening hook.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {storySparks.map((spark, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl bg-[#FFF8EC] border border-[#F5C4A8] p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <select
                            aria-label={`Story spark ${idx + 1} prompt`}
                            value={spark.question}
                            onChange={(e) =>
                              setStorySparks((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, question: e.target.value } : item
                                )
                              )
                            }
                            className="flex-1 min-w-0 min-h-[38px] px-3 py-1.5 rounded-xl border border-[#F5C4A8] bg-white text-xs font-bold text-[#3D2817] focus:outline-none focus:border-[#E8603A]"
                          >
                            {STORY_SPARK_PROMPTS.map((q) => (
                              <option key={q} value={q}>
                                {q}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setStorySparks((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="min-h-[36px] px-2.5 text-xs font-bold text-[#C44C29] hover:underline shrink-0 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="text"
                          maxLength={VOLUMETRIC_LIMITS.MAX_SPARK_ANSWER_LEN}
                          value={spark.answer}
                          onChange={(e) =>
                            setStorySparks((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, answer: e.target.value } : item
                              )
                            )
                          }
                          placeholder="Write your short answer..."
                          className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-[#F5C4A8] bg-white text-xs font-medium text-[#3D2817] focus:outline-none focus:border-[#E8603A]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Group C: Interests */}
              <div className="pt-6 border-t border-[#FDE4D8] space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-[#3D2817]">
                    3. Interests ({interests.length}/{VOLUMETRIC_LIMITS.MAX_INTERESTS})
                  </h3>
                  <p className="text-xs text-[#7A5234] mt-0.5">
                    Used to highlight common interests and tailored icebreakers with matches.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((tag) => {
                    const active = interests.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleInterest(tag)}
                        className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                          active
                            ? 'bg-[#E8603A] text-white border-[#E8603A]'
                            : 'bg-[#FFF8EC] text-[#3D2817] border-[#F5C4A8] hover:border-[#E8603A]'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group D: Neighborhood */}
              <div className="pt-6 border-t border-[#FDE4D8] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#3D2817]">
                      4. Neighborhood: {city}
                    </h3>
                    <p className="text-xs font-mono text-[#2E6B5C] mt-0.5">
                      Privacy-snapped (~300m): {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLocate}
                    disabled={locating}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#DCF0EA]/65 hover:bg-[#DCF0EA] border border-[#A9D7C8] text-xs font-bold text-[#2E6B5C] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <LocateFixed className="w-3.5 h-3.5 shrink-0" />
                    <span>{locating ? 'Locating...' : 'Use Current GPS'}</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CITY_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        const snapped = jitterForPrivacy(preset.lat, preset.lng, profile.uid);
                        setCity(preset.label);
                        setCoords({ lat: snapped.approxLat, lng: snapped.approxLng });
                      }}
                      className={`min-h-[36px] px-3 py-1 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                        city === preset.label
                          ? 'bg-[#3D8C7A] text-white border-[#3D8C7A]'
                          : 'bg-[#FFF8EC] text-[#3D2817] border-[#F5C4A8] hover:border-[#3D8C7A]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#FDE4D8] flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[#7A5234]">
                  Updates apply to your live discovery card immediately.
                </span>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="min-h-[46px] px-6 py-2.5 rounded-2xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-sm font-bold inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingProfile ? 'Saving...' : 'Save Profile & Bio'}</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* SECTION 2: PHOTOS */}
          {activeSection === 'photos' ? (
            <div className="space-y-6">
              <div className="pb-4 border-b border-[#FDE4D8]">
                <h2 className="text-2xl font-bold text-[#3D2817]">Profile Pictures</h2>
                <p className="text-sm text-[#7A5234] mt-0.5">
                  Upload 5 to 6 clear photos. Changing pictures triggers a security selfie &amp; age check.
                </p>
              </div>

              <PhotoGalleryEditor
                photos={photos}
                onChange={setPhotos}
                requireVerificationOnChange
                hasUnsavedChanges={photosChanged}
              />

              <div className="pt-4 border-t border-[#FDE4D8] flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[#7A5234]">
                  {photosBelowMinimum
                    ? `Add ${VOLUMETRIC_LIMITS.MIN_PHOTOS - photos.length} more picture(s) before saving.`
                    : photosChanged
                    ? 'Saving picture changes opens live verification.'
                    : 'Your photo gallery meets the 5–6 picture requirement.'}
                </span>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={savingProfile || photosBelowMinimum}
                  className="min-h-[46px] px-6 py-2.5 rounded-2xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-sm font-bold inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-55"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {savingProfile
                      ? 'Saving...'
                      : photosChanged
                      ? 'Save Pictures & Verify (Selfie + Age)'
                      : 'Save Picture Order'}
                  </span>
                </button>
              </div>
            </div>
          ) : null}

          {/* SECTION 3: MATCH PREFERENCES */}
          {activeSection === 'preferences' ? (
            <div className="space-y-6">
              <div className="pb-4 border-b border-[#FDE4D8]">
                <h2 className="text-2xl font-bold text-[#3D2817]">Match Preferences</h2>
                <p className="text-sm text-[#7A5234] mt-0.5">
                  Control who appears in your Discover feed, your preferred age window, and search radius.
                </p>
              </div>

              {/* Discovery Visibility Row */}
              <div className="rounded-2xl bg-[#FFF8EC] border border-[#F5C4A8] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-[#3D2817]">Discovery Visibility</p>
                  <p className="text-xs text-[#7A5234]">
                    {showMe
                      ? 'Active — nearby people matching your preferences can see your card.'
                      : 'Paused — hidden from Discover while existing matches & chats stay open.'}
                  </p>
                </div>
                <label className="inline-flex items-center gap-2.5 min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white border border-[#F5C4A8] text-xs font-bold text-[#3D2817] shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMe}
                    onChange={(e) => setShowMe(e.target.checked)}
                    className="w-4 h-4 accent-[#3D8C7A]"
                  />
                  <span>{showMe ? 'Show me in Discover' : 'Hidden from Discover'}</span>
                </label>
              </div>

              {/* Interested In */}
              <div className="space-y-2">
                <span className="block text-sm font-bold text-[#3D2817]">
                  I&apos;m interested in meeting
                </span>
                <p className="text-xs text-[#7A5234]">Select one or more options.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  {GENDER_OPTIONS.map((opt) => {
                    const active = interestedIn.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleInterestedIn(opt.value)}
                        className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                          active
                            ? 'bg-[#3D8C7A] text-white border-[#3D8C7A]'
                            : 'bg-[#FFF8EC] text-[#3D2817] border-[#F5C4A8] hover:border-[#3D8C7A]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Age & Distance Sliders */}
              <div className="pt-5 border-t border-[#FDE4D8] grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <div className="flex justify-between text-xs font-bold text-[#3D2817]">
                    <span>Preferred age range</span>
                    <span className="font-mono text-[#E8603A] tabular-nums">
                      {minAge}–{maxAge} yrs
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[11px] text-[#7A5234] mb-1">Min ({minAge})</span>
                      <input
                        type="range"
                        aria-label="Minimum preferred age"
                        min={18}
                        max={65}
                        value={minAge}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setMinAge(v);
                          if (maxAge < v) setMaxAge(v);
                        }}
                        className="w-full accent-[#E8603A]"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-[#7A5234] mb-1">Max ({maxAge})</span>
                      <input
                        type="range"
                        aria-label="Maximum preferred age"
                        min={18}
                        max={80}
                        value={maxAge}
                        onChange={(e) => setMaxAge(Math.max(minAge, Number(e.target.value)))}
                        className="w-full accent-[#E8603A]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between text-xs font-bold text-[#3D2817]">
                    <span>Maximum distance</span>
                    <span className="font-mono text-[#2E6B5C] tabular-nums">
                      {maxDistanceKm} km
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Maximum distance in kilometers"
                    min={5}
                    max={200}
                    step={5}
                    value={maxDistanceKm}
                    onChange={(e) => setMaxDistanceKm(Number(e.target.value))}
                    className="w-full accent-[#3D8C7A] mt-3"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-[#9E7756]">
                    <span>5 km</span>
                    <span>200 km</span>
                  </div>
                </div>
              </div>

              {/* Strict Boundaries */}
              <div className="pt-5 border-t border-[#FDE4D8] space-y-3">
                <h3 className="text-sm font-bold text-[#3D2817]">Strict Boundaries</h3>
                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#FFF8EC] border border-[#F5C4A8] text-xs text-[#3D2817] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={strictAgeBoundary}
                    onChange={(e) => setStrictAgeBoundary(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-[#E8603A] shrink-0"
                  />
                  <span>
                    <span className="font-bold">Strict Age Boundary</span> — treat my {minAge}–
                    {maxAge} range as a hard limit without ±2 year flexibility.
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#FFF8EC] border border-[#F5C4A8] text-xs text-[#3D2817] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={strictDistanceBoundary}
                    onChange={(e) => setStrictDistanceBoundary(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-[#3D8C7A] shrink-0"
                  />
                  <span>
                    <span className="font-bold">Strict Distance Boundary</span> — never widen
                    beyond {maxDistanceKm} km even when nearby picks run low.
                  </span>
                </label>
              </div>

              <div className="pt-4 border-t border-[#FDE4D8] flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[#7A5234]">
                  Filters update your Discover queue as soon as you save.
                </span>
                <button
                  type="button"
                  onClick={handleSavePrefs}
                  disabled={savingPrefs}
                  className="min-h-[46px] px-6 py-2.5 rounded-2xl bg-[#3D8C7A] hover:bg-[#2E6B5C] text-white text-sm font-bold inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingPrefs ? 'Updating...' : 'Save Match Preferences'}</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* SECTION 4: SAFETY & ACCOUNT */}
          {activeSection === 'safety' ? (
            <div className="space-y-7">
              <div className="pb-4 border-b border-[#FDE4D8]">
                <h2 className="text-2xl font-bold text-[#3D2817]">
                  Verification, Safety &amp; Account
                </h2>
                <p className="text-sm text-[#7A5234] mt-0.5">
                  Manage live identity verification, blocked members, cookie consent, and account controls.
                </p>
              </div>

              {/* Identity Verification Checklist */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#3D2817]">1. Verification Center</h3>
                <div className="divide-y divide-[#FDE4D8] rounded-2xl border border-[#F5C4A8] bg-[#FFF8EC]/60 overflow-hidden">
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white border border-[#F5C4A8] text-[#E8603A] flex items-center justify-center shrink-0">
                        <IdCard className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#3D2817]">
                          Age &amp; Real ID Verification
                        </p>
                        <p className="text-xs text-[#7A5234] mt-0.5">
                          {verificationStatus.isProfileVerified ? (
                            <span className="text-[#2E6B5C] inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Verified · Age {profile.age} (
                                {privateAccount.verificationLast4 ?? 'ID on file'})
                              </span>
                            </span>
                          ) : verificationStatus.reason === 'photo_change' ? (
                            'Required again after profile picture changes'
                          ) : (
                            'Required once before starting chats'
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenVerification('profile_id')}
                      className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                        verificationStatus.isProfileVerified
                          ? 'bg-white border border-[#A9D7C8] text-[#2E6B5C] hover:bg-[#DCF0EA]/40'
                          : 'bg-[#E8603A] hover:bg-[#C44C29] text-white'
                      }`}
                    >
                      {verificationStatus.isProfileVerified
                        ? 'Update Age/ID'
                        : 'Verify Age & ID'}
                    </button>
                  </div>

                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white border border-[#A9D7C8] text-[#2E6B5C] flex items-center justify-center shrink-0">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#3D2817]">
                          Selfie Verification (Live Camera Only)
                        </p>
                        <p className="text-xs text-[#7A5234] mt-0.5">
                          {verificationStatus.reason === 'photo_change' &&
                          !verificationStatus.isSelfieVerified ? (
                            'Required after profile picture update'
                          ) : verificationStatus.securityCheckPending ? (
                            'Periodic security selfie check due'
                          ) : verificationStatus.isSelfieVerified ? (
                            <span className="text-[#2E6B5C] inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Live Camera Selfie Verified</span>
                            </span>
                          ) : (
                            'Confirm you match your profile pictures via live camera'
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenVerification('selfie')}
                      className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                        verificationStatus.isSelfieVerified &&
                        !verificationStatus.securityCheckPending
                          ? 'bg-white border border-[#A9D7C8] text-[#2E6B5C] hover:bg-[#DCF0EA]/40'
                          : 'bg-[#3D8C7A] hover:bg-[#2E6B5C] text-white'
                      }`}
                    >
                      {verificationStatus.reason === 'photo_change' &&
                      !verificationStatus.isSelfieVerified
                        ? 'Verify Selfie'
                        : verificationStatus.securityCheckPending
                        ? 'Run Security Check'
                        : verificationStatus.isSelfieVerified
                        ? 'Retake Selfie'
                        : 'Open Live Camera'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Privacy & Guidelines */}
              <div className="pt-6 border-t border-[#FDE4D8] space-y-3">
                <h3 className="text-sm font-bold text-[#3D2817]">2. Privacy &amp; Safety Tools</h3>
                <p className="text-xs text-[#7A5234]">
                  <a href="/privacy.html" target="_blank" rel="noreferrer" className="font-semibold underline hover:text-[#E8603A]">
                    Privacy Policy
                  </a>
                  <span className="mx-2">·</span>
                  <a href="/terms.html" target="_blank" rel="noreferrer" className="font-semibold underline hover:text-[#E8603A]">
                    Terms of Service
                  </a>
                </p>
                <div className="divide-y divide-[#FDE4D8] rounded-2xl border border-[#F5C4A8] bg-white overflow-hidden">
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-[#2E6B5C] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-[#3D2817]">Dating Safety Guidelines</p>
                        <p className="text-xs text-[#7A5234]">
                          Tips for keeping conversations safe and planning comfortable first meetups.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSafetyTipsModal(true)}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#DCF0EA] hover:bg-[#CBE8DF] border border-[#A9D7C8] text-xs font-bold text-[#2E6B5C] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Open Safety Tips
                    </button>
                  </div>

                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <Cookie className="w-5 h-5 text-[#E8603A] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#3D2817]">Cookie Preferences</p>
                        <p className="text-xs text-[#7A5234] truncate">{consentSummary}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCookiePreferences(true)}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FFF8EC] hover:bg-[#FDE4D8]/60 border border-[#F5C4A8] text-xs font-bold text-[#3D2817] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Manage Cookies
                    </button>
                  </div>

                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <Bell className="w-5 h-5 text-[#E8603A] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#3D2817]">Push Notifications (FCM)</p>
                        <p className="text-xs text-[#7A5234]">
                          {fcmEnabled ? 'Real-time push alerts enabled' : 'Receive instant alerts for new matches and messages'}
                        </p>
                        {fcmNotice ? (
                          <p className="text-xs font-semibold text-[#2E6B5C] mt-1">{fcmNotice}</p>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={fcmLoading || fcmEnabled}
                      onClick={() => void handleEnablePush()}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] disabled:bg-[#A9D7C8] text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {fcmLoading ? 'Enabling...' : fcmEnabled ? 'Enabled' : 'Enable Push'}
                    </button>
                  </div>

                  <div className="p-4 flex items-start gap-3 bg-[#FFF8EC]/50">
                    <Shield className="w-5 h-5 text-[#2E6B5C] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#7A5234] leading-relaxed">
                      <span className="font-bold text-[#3D2817]">Private Vault Protection:</span>{' '}
                      Your DOB ({privateAccount.dob}), email, and strict discovery boundaries are
                      isolated in owner-only private storage and never exposed on your public card.
                    </p>
                  </div>
                </div>
              </div>

              {/* Blocked Members */}
              <div className="pt-6 border-t border-[#FDE4D8] space-y-3">
                <h3 className="text-sm font-bold text-[#3D2817] flex items-center gap-1.5">
                  <Ban className="w-4 h-4 text-[#C44C29]" />
                  <span>3. Blocked Members ({blocks.length})</span>
                </h3>
                {blocks.length === 0 ? (
                  <p className="text-xs text-[#7A5234] bg-[#FFF8EC] border border-[#F5C4A8] rounded-2xl p-4">
                    You haven&apos;t blocked anyone. Blocked members are immediately removed from
                    discovery and active conversations.
                  </p>
                ) : (
                  <div className="divide-y divide-[#FDE4D8] rounded-2xl border border-[#F5C4A8] bg-white px-4">
                    {blocks.map((b) => (
                      <div key={b.id} className="py-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[#3D2817] truncate">
                          {b.blockedName}
                        </span>
                        <button
                          type="button"
                          onClick={() => unblockUser(profile.uid, b.blockedId)}
                          className="min-h-[36px] px-3 py-1 rounded-xl border border-[#A9D7C8] bg-[#DCF0EA]/60 hover:bg-[#DCF0EA] text-xs font-bold text-[#2E6B5C] inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Unblock</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Danger Zone: Account Deletion */}
              <div className="pt-6 border-t border-[#FDE4D8]">
                <div className="rounded-2xl border border-[#F5C2C0] bg-[#FEECEB]/55 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#C0392B]">Delete Account</p>
                    <p className="text-xs text-[#7A5234]">
                      Permanently remove private PII and hide your profile card from NearMatch.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-white hover:bg-[#FDE4D8] border border-[#F5C2C0] text-[#C0392B] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Account</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {showCardPreview ? (
        <ProfileDetailModal
          profile={previewProfileSnapshot}
          viewerLat={coords.lat}
          viewerLng={coords.lng}
          isSelfPreview
          onClose={() => setShowCardPreview(false)}
        />
      ) : null}

      {showSafetyTipsModal ? (
        <SafetyTipsModal onClose={() => setShowSafetyTipsModal(false)} />
      ) : null}

      {showDeleteModal ? (
        <ConfirmActionModal
          title="Deactivate your NearMatch account?"
          description="Your private account data (email, DOB, and filters) will be deleted immediately and your public card will be permanently hidden."
          confirmLabel="Deactivate & Sign Out"
          destructive
          busy={deleting}
          onConfirm={handleDeactivate}
          onCancel={() => setShowDeleteModal(false)}
        />
      ) : null}
    </div>
  );
}
