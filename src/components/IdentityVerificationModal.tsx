import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  IdCard,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { VERIFICATION_DOC_OPTIONS } from '../lib/constants';
import {
  submitProfileIdentityVerification,
  submitSelfieVerification,
} from '../lib/firestoreService';
import {
  getVerificationStatus,
  LIVENESS_CHALLENGES,
  validateIdentitySubmission,
} from '../lib/identityVerification';
import { ageFromDob } from '../lib/matching';
import type { PrivateAccount, PublicProfile, VerificationDocType } from '../types/models';

export type VerificationTab = 'profile_id' | 'selfie';

interface IdentityVerificationModalProps {
  profile: PublicProfile;
  privateAccount: PrivateAccount;
  initialTab?: VerificationTab;
  contextTitle?: string;
  contextSubtitle?: string;
  onClose: () => void;
  onVerificationUpdated?: () => void;
}

export function IdentityVerificationModal({
  profile,
  privateAccount,
  initialTab,
  contextTitle,
  contextSubtitle,
  onClose,
  onVerificationUpdated,
}: IdentityVerificationModalProps) {
  const status = getVerificationStatus(profile, privateAccount);

  const [activeTab, setActiveTab] = useState<VerificationTab>(() => {
    if (initialTab) return initialTab;
    if (status.reason === 'security_check') return 'selfie';
    if (status.reason === 'photo_change') {
      return !status.isSelfieVerified ? 'selfie' : 'profile_id';
    }
    return status.isProfileVerified && !status.isSelfieVerified ? 'selfie' : 'profile_id';
  });

  // Real Identity + Age Verification Form State
  const [fullName, setFullName] = useState(
    privateAccount.verificationFullName ?? profile.displayName
  );
  const [dob, setDob] = useState(privateAccount.dob || '1997-06-15');
  const [docType, setDocType] = useState<VerificationDocType>(
    privateAccount.verificationDocType ?? 'national_id'
  );
  const [last4, setLast4] = useState(privateAccount.verificationLast4 ?? '');
  const [attested, setAttested] = useState(status.isProfileVerified);
  const [savingId, setSavingId] = useState(false);
  const [localIdDone, setLocalIdDone] = useState(false);
  const [localSelfieDone, setLocalSelfieDone] = useState(false);
  const verifiedAge = ageFromDob(dob);
  const effectiveProfileVerified = status.isProfileVerified || localIdDone;
  const effectiveSelfieVerified =
    (status.isSelfieVerified && status.reason !== 'security_check') || localSelfieDone;

  // Live Selfie State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedSelfieUrl, setCapturedSelfieUrl] = useState<string | null>(null);
  const [challengeIdx, setChallengeIdx] = useState(0);
  const [savingSelfie, setSavingSelfie] = useState(false);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'selfie') {
      stopCamera();
    }
  }, [activeTab]);

  const startLiveCamera = async () => {
    setError(null);
    setCameraError(null);
    setCapturedSelfieUrl(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live front-camera access is required for selfie verification and is unavailable in this browser.');
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {
            // Autoplay fallback handled by user tap if blocked
          });
        }
      }, 40);
    } catch {
      setCameraError(
        'Camera permission was declined or unavailable. Please allow front-camera access to verify live.'
      );
      setCameraActive(false);
    }
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError('Camera preview is still warming up. Wait a moment and try again.');
      return;
    }
    const canvas = document.createElement('canvas');
    const size = Math.min(video.videoWidth, video.videoHeight, 480);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    setCapturedSelfieUrl(dataUrl);
    stopCamera();
  };

  const handleSubmitProfileId = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    const validationError = validateIdentitySubmission({
      fullName,
      docType,
      last4,
      dob,
      attested,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSavingId(true);
    try {
      await submitProfileIdentityVerification({
        uid: profile.uid,
        fullName,
        docType,
        last4,
        verifiedDob: dob,
        alreadySelfieVerified: effectiveSelfieVerified,
        alreadyHasFirstVerifiedAt: Boolean(privateAccount.firstVerifiedAt),
      });
      setLocalIdDone(true);
      onVerificationUpdated?.();
      if (!effectiveSelfieVerified) {
        setFeedback('Age & Real ID Verification completed. Next, complete Live Selfie Verification.');
        setActiveTab('selfie');
      } else {
        setFeedback('Age & Real ID Verification completed. Your profile is now verified.');
        window.setTimeout(() => {
          onClose();
        }, 550);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save identity verification.');
    } finally {
      setSavingId(false);
    }
  };

  const handleConfirmSelfie = async () => {
    if (!capturedSelfieUrl) {
      setError('Capture a live selfie using your front camera first.');
      return;
    }
    setError(null);
    setFeedback(null);
    setSavingSelfie(true);
    try {
      await submitSelfieVerification({
        uid: profile.uid,
        alreadyProfileVerified: effectiveProfileVerified,
        alreadyHasFirstVerifiedAt: Boolean(privateAccount.firstVerifiedAt),
      });
      setLocalSelfieDone(true);
      onVerificationUpdated?.();
      if (effectiveProfileVerified) {
        setFeedback(
          status.reason === 'security_check'
            ? 'Random security selfie check completed. Your chat access is restored.'
            : status.reason === 'photo_change'
            ? 'Photo change security verification completed. Your profile and chat access are active.'
            : 'Live Selfie Verification completed.'
        );
        window.setTimeout(() => {
          onClose();
        }, 550);
      } else {
        setFeedback('Live Selfie Verification completed. Next, confirm your Age & Real ID Verification.');
        setActiveTab('profile_id');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save selfie verification.');
    } finally {
      setSavingSelfie(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2B1A10]/65 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Real Identity and Selfie Verification"
    >
      <div className="bg-white border border-[#F5C4A8] rounded-[28px] max-w-xl w-full overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        <div className="p-5 sm:p-6 border-b border-[#FDE4D8] flex items-start justify-between gap-3 bg-[#FFF8EC]/70">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#DCF0EA] border border-[#A9D7C8] text-[#2E6B5C] flex items-center justify-center shrink-0">
              {status.reason === 'security_check' || status.reason === 'photo_change' ? (
                <ShieldAlert className="w-5 h-5 text-[#C44C29]" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#3D2817]">
                {contextTitle ??
                  (status.reason === 'photo_change'
                    ? 'Photo Change Security Check'
                    : status.reason === 'security_check'
                    ? 'Quick Security Verification Check'
                    : 'Age, ID & Selfie Verification')}
              </h2>
              <p className="text-xs text-[#7A5234] mt-0.5 leading-relaxed">
                {contextSubtitle ??
                  (status.reason === 'photo_change'
                    ? 'Because your profile pictures were changed, complete both Live Selfie Verification and Age Verification (18+ ID) to keep your profile verified.'
                    : status.reason === 'security_check'
                    ? 'For community safety, NearMatch occasionally runs a quick random selfie re-check between chats.'
                    : 'Complete both Age & Real ID Verification and Live Selfie Verification once to start chatting with your matches. Periodic random checks and photo-change checks keep members safe.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="Close verification modal"
            className="w-9 h-9 rounded-xl hover:bg-[#FDE4D8] text-[#7A5234] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two Separate Verification Options */}
        <div className="px-5 sm:px-6 pt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('profile_id');
              setError(null);
            }}
            className={`min-h-[48px] px-3.5 py-2.5 rounded-2xl border text-left transition-colors cursor-pointer flex items-center gap-2.5 ${
              activeTab === 'profile_id'
                ? 'border-[#E8603A] bg-[#FDE4D8]/60 text-[#3D2817]'
                : 'border-[#F5C4A8] bg-[#FFF8EC] text-[#7A5234] hover:border-[#E8603A]'
            }`}
          >
            <IdCard className="w-4 h-4 text-[#E8603A] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate">1. Age &amp; Real ID</p>
              <p className="text-[11px] truncate text-[#2E6B5C] font-semibold">
                {effectiveProfileVerified
                  ? `Verified · ${verifiedAge ?? profile.age}+`
                  : 'Age & ID Required'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('selfie');
              setError(null);
            }}
            className={`min-h-[48px] px-3.5 py-2.5 rounded-2xl border text-left transition-colors cursor-pointer flex items-center gap-2.5 ${
              activeTab === 'selfie'
                ? 'border-[#3D8C7A] bg-[#DCF0EA]/70 text-[#3D2817]'
                : 'border-[#F5C4A8] bg-[#FFF8EC] text-[#7A5234] hover:border-[#3D8C7A]'
            }`}
          >
            <Camera className="w-4 h-4 text-[#2E6B5C] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate">2. Selfie Verification</p>
              <p className="text-[11px] truncate text-[#2E6B5C] font-semibold">
                {effectiveSelfieVerified
                  ? 'Live Selfie Verified'
                  : status.reason === 'photo_change'
                  ? 'Photo Change Check'
                  : status.securityCheckPending
                  ? 'Security Re-Check Due'
                  : 'Live Check Required'}
              </p>
            </div>
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {error ? (
            <div className="p-3 rounded-xl bg-[#FEECEB] border border-[#F5C2C0] text-xs font-semibold text-[#C0392B]">
              {error}
            </div>
          ) : null}

          {feedback ? (
            <div className="p-3 rounded-xl bg-[#DCF0EA] border border-[#A9D7C8] text-xs font-bold text-[#2E6B5C] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          ) : null}

          {activeTab === 'profile_id' ? (
            <form onSubmit={handleSubmitProfileId} className="space-y-4">
              {effectiveProfileVerified ? (
                <div className="p-3.5 rounded-2xl bg-[#DCF0EA]/65 border border-[#A9D7C8] text-xs text-[#2E6B5C] space-y-1">
                  <p className="font-bold">Age &amp; Real ID Verified</p>
                  <p>
                    Saved privately: {privateAccount.verificationFullName || profile.displayName} · Age {verifiedAge ?? profile.age} ·{' '}
                    {VERIFICATION_DOC_OPTIONS.find((d) => d.value === docType)?.label ?? 'Official ID'} ending in{' '}
                    <span className="font-mono font-bold">
                      {privateAccount.verificationLast4 || last4 || '****'}
                    </span>
                  </p>
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-bold text-[#7A5234] uppercase tracking-wider mb-1.5">
                  Full Legal Name (As on Government ID)
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your legal name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-sm font-semibold text-[#3D2817] focus:outline-none focus:border-[#E8603A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#7A5234] uppercase tracking-wider mb-1.5">
                    Date of Birth (Age Verification)
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-sm font-semibold text-[#3D2817] focus:outline-none focus:border-[#E8603A]"
                  />
                  <p
                    className={`text-[11px] font-semibold mt-1 ${
                      verifiedAge !== null && verifiedAge >= 18
                        ? 'text-[#2E6B5C]'
                        : 'text-[#C0392B]'
                    }`}
                  >
                    {verifiedAge !== null && verifiedAge >= 18
                      ? `Verified age: ${verifiedAge} years old (18+ eligible)`
                      : 'Must be at least 18 years old'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#7A5234] uppercase tracking-wider mb-1.5">
                    Identity Document Type
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as VerificationDocType)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-sm font-semibold text-[#3D2817] focus:outline-none focus:border-[#E8603A]"
                  >
                    {VERIFICATION_DOC_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7A5234] uppercase tracking-wider mb-1.5">
                  Last 4 Characters of ID
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={last4}
                  onChange={(e) => setLast4(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                  placeholder="e.g. 482A"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-sm font-mono font-bold tracking-widest text-[#3D2817] focus:outline-none focus:border-[#E8603A]"
                />
              </div>

              <label className="flex items-start gap-2.5 text-xs font-semibold text-[#3D2817] cursor-pointer">
                <input
                  type="checkbox"
                  checked={attested}
                  onChange={(e) => setAttested(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-[#3D8C7A] shrink-0"
                />
                <span className="leading-relaxed">
                  I confirm this matches my real identity, 18+ date of birth ({dob}), and uploaded profile pictures. ID details stay strictly private.
                </span>
              </label>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={savingId}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <IdCard className="w-4 h-4" />
                  <span>
                    {savingId
                      ? 'Verifying...'
                      : effectiveProfileVerified
                      ? 'Update Age & ID Verification'
                      : 'Verify Age & Real ID'}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-[#FFF8EC] border border-[#F5C4A8] rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-[#2E6B5C] font-semibold">
                    Live Liveness Prompt
                  </p>
                  <p className="text-xs font-bold text-[#3D2817] mt-0.5">
                    {LIVENESS_CHALLENGES[challengeIdx % LIVENESS_CHALLENGES.length]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setChallengeIdx((i) => (i + 1) % LIVENESS_CHALLENGES.length)}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white border border-[#F5C4A8] text-[11px] font-bold text-[#7A5234] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>New pose</span>
                </button>
              </div>

              <div className="relative aspect-square max-w-[260px] mx-auto rounded-3xl overflow-hidden bg-[#2B1A10] border-2 border-[#F5C4A8] flex items-center justify-center">
                {capturedSelfieUrl ? (
                  <img
                    src={capturedSelfieUrl}
                    alt="Captured verification selfie preview"
                    className="w-full h-full object-cover"
                  />
                ) : cameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-6 rounded-full border-2 border-dashed border-[#A9D7C8]/85"
                    />
                  </>
                ) : (
                  <div className="p-6 text-center space-y-2 text-[#FFF8EC]">
                    <Camera className="w-8 h-8 mx-auto text-[#A9D7C8]" />
                    <p className="text-xs font-semibold leading-relaxed">
                      Open your live front camera to capture a real-time selfie. Photo uploads are disabled to prevent fake or morphed images.
                    </p>
                  </div>
                )}
              </div>

              {cameraError ? (
                <p className="text-xs font-medium text-[#7A5234] text-center">{cameraError}</p>
              ) : null}

              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {!cameraActive && !capturedSelfieUrl ? (
                  <button
                    type="button"
                    onClick={() => void startLiveCamera()}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#3D8C7A] hover:bg-[#2E6B5C] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Open Live Camera</span>
                  </button>
                ) : null}

                {cameraActive ? (
                  <button
                    type="button"
                    onClick={captureFromVideo}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Capture Live Selfie</span>
                  </button>
                ) : null}

                {capturedSelfieUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedSelfieUrl(null);
                        void startLiveCamera();
                      }}
                      className="min-h-[42px] px-4 py-2 rounded-xl border border-[#F5C4A8] bg-white hover:bg-[#FFF8EC] text-xs font-bold text-[#7A5234] cursor-pointer"
                    >
                      Retake
                    </button>
                    <button
                      type="button"
                      disabled={savingSelfie}
                      onClick={() => void handleConfirmSelfie()}
                      className="min-h-[42px] px-5 py-2 rounded-xl bg-[#3D8C7A] hover:bg-[#2E6B5C] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {savingSelfie ? 'Confirming...' : 'Confirm Selfie Verification'}
                      </span>
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
