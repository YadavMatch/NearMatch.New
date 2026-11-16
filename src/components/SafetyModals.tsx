import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  ChevronLeft,
  ChevronRight,
  Coffee,
  EyeOff,
  Flag,
  HeartHandshake,
  Lock,
  MapPin,
  MessageCircleHeart,
  Navigation,
  PhoneCall,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { REPORT_REASON_OPTIONS, VOLUMETRIC_LIMITS } from '../lib/constants';
import { displayDistance, haversineKm } from '../lib/matching';
import type { PublicProfile, ReportReason } from '../types/models';
import { AvatarImage } from './AvatarImage';

interface ConfirmActionModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmActionModal({
  title,
  description,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2B1A10]/65 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => {
        if (!busy) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-action-title"
    >
      <div
        className="bg-white border border-[#F5C4A8] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              destructive ? 'bg-[#FDE4D8] text-[#C44C29]' : 'bg-[#DCF0EA] text-[#2E6B5C]'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 id="confirm-action-title" className="text-xl font-bold text-[#3D2817]">
              {title}
            </h3>
            <p className="text-sm text-[#7A5234] mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-[42px] px-4 py-2 rounded-xl border border-[#F5C4A8] text-sm font-bold text-[#7A5234] hover:bg-[#FFF8EC] cursor-pointer disabled:opacity-55"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer disabled:opacity-60 ${
              destructive ? 'bg-[#E8603A] hover:bg-[#C44C29]' : 'bg-[#3D8C7A] hover:bg-[#2E6B5C]'
            }`}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ReportModalProps {
  targetName: string;
  busy?: boolean;
  onSubmit: (payload: { reason: ReportReason; details: string; alsoBlock: boolean }) => void;
  onClose: () => void;
}

export function ReportModal({ targetName, busy = false, onSubmit, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);

  return (
    <div className="fixed inset-0 z-50 bg-[#2B1A10]/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#F5C4A8] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FDE4D8] text-[#C44C29] flex items-center justify-center">
              <Flag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#3D2817]">Report {targetName}</h3>
              <p className="text-xs text-[#7A5234]">Reports are private and logged safely to Firestore.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-[#FFF8EC] flex items-center justify-center text-[#7A5234] cursor-pointer"
            aria-label="Close report modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          {REPORT_REASON_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setReason(opt.value)}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                reason === opt.value
                  ? 'border-[#E8603A] bg-[#FDE4D8]/60'
                  : 'border-[#F5C4A8] bg-[#FFF8EC] hover:bg-[#FDE4D8]/30'
              }`}
            >
              <p className="text-sm font-bold text-[#3D2817]">{opt.label}</p>
              <p className="text-xs text-[#7A5234]">{opt.hint}</p>
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-bold text-[#7A5234] mb-1.5">
            Additional details (optional)
          </label>
          <textarea
            rows={3}
            maxLength={VOLUMETRIC_LIMITS.MAX_REPORT_DETAILS_LEN}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Share helpful context for safety review..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-sm text-[#3D2817] focus:outline-none focus:border-[#E8603A]"
          />
        </div>

        <label className="flex items-center gap-2.5 text-sm font-semibold text-[#3D2817] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={alsoBlock}
            onChange={(e) => setAlsoBlock(e.target.checked)}
            className="w-4 h-4 accent-[#E8603A]"
          />
          <span>Also block {targetName} and close any active chat</span>
        </label>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-[42px] px-4 py-2 rounded-xl border border-[#F5C4A8] text-sm font-bold text-[#7A5234] hover:bg-[#FFF8EC] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ reason, details, alsoBlock })}
            disabled={busy}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-sm font-bold cursor-pointer disabled:opacity-60"
          >
            {busy ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ProfileDetailModalProps {
  profile: PublicProfile;
  viewerLat: number;
  viewerLng: number;
  isSelfPreview?: boolean;
  onBlock?: () => void;
  onReport?: () => void;
  onClose: () => void;
}

export function ProfileDetailModal({
  profile,
  viewerLat,
  viewerLng,
  isSelfPreview = false,
  onBlock,
  onReport,
  onClose,
}: ProfileDetailModalProps) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const photos = profile.photos.length > 0 ? profile.photos : [''];
  const activePhotoIdx = Math.min(photoIdx, Math.max(0, photos.length - 1));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const distKm = isSelfPreview
    ? 0.3
    : haversineKm(viewerLat, viewerLng, profile.approxLat, profile.approxLng);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2B1A10]/65 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white border border-[#F5C4A8] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[4/3] bg-[#FDE4D8] shrink-0">
          <AvatarImage
            src={photos[activePhotoIdx]}
            name={profile.displayName}
            className="w-full h-full"
          />

          {photos.length > 1 ? (
            <>
              <div className="absolute top-3 inset-x-16 flex items-center gap-1.5 pointer-events-none">
                {photos.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      idx === activePhotoIdx ? 'bg-white' : 'bg-white/45'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                aria-label="Previous profile picture"
                className="absolute left-3 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] rounded-full bg-white/90 hover:bg-white text-[#3D2817] flex items-center justify-center shadow-sm cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                aria-label="Next profile picture"
                className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] rounded-full bg-white/90 hover:bg-white text-[#3D2817] flex items-center justify-center shadow-sm cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-[#2B1A10]/75 text-white text-[11px] font-mono font-bold">
                {activePhotoIdx + 1} / {photos.length}
              </span>
            </>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 min-w-[40px] min-h-[40px] rounded-full bg-white/95 hover:bg-white text-[#3D2817] flex items-center justify-center shadow-sm cursor-pointer"
            aria-label="Close profile details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <div>
            {isSelfPreview ? (
              <p className="text-xs font-mono uppercase tracking-wider text-[#2E6B5C] font-semibold mb-1">
                Public Discovery Card Preview
              </p>
            ) : null}
            <h3 className="text-2xl font-bold text-[#3D2817]">
              {profile.displayName}, {profile.age}
            </h3>
            <p className="text-sm text-[#7A5234] flex items-center gap-1.5 mt-1 font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#3D8C7A]" />
              <span>
                {profile.jobTitle || 'NearMatch Member'} · {profile.city} ·{' '}
                {isSelfPreview ? '< 1 km (~300m snap)' : displayDistance(distKm)}
              </span>
            </p>
            {profile.connectionGoal || (profile.isProfileVerified && profile.isSelfieVerified) ? (
              <p className="text-xs font-semibold text-[#2E6B5C] mt-1.5 flex items-center gap-1.5">
                {profile.isProfileVerified && profile.isSelfieVerified ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Real ID &amp; Selfie Verified</span>
                  </>
                ) : null}
                {profile.isProfileVerified && profile.isSelfieVerified && profile.connectionGoal ? (
                  <span aria-hidden="true">·</span>
                ) : null}
                {profile.connectionGoal ? <span>{profile.connectionGoal}</span> : null}
              </p>
            ) : null}
          </div>

          <p className="text-sm text-[#3D2817] leading-relaxed">
            {profile.bio || 'No bio added yet.'}
          </p>

          {profile.storySparks && profile.storySparks.length > 0 ? (
            <div className="pt-2 border-t border-[#FDE4D8] space-y-2.5">
              <p className="text-xs font-mono uppercase tracking-wider text-[#9E7756]">
                Story Sparks
              </p>
              {profile.storySparks.map((spark, idx) => (
                <div key={idx} className="bg-[#FFF8EC] rounded-2xl p-3 space-y-1">
                  <p className="text-[11px] font-bold text-[#7A5234]">{spark.question}</p>
                  <p className="text-sm font-medium text-[#3D2817] leading-relaxed">
                    {spark.answer}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {profile.interests.length > 0 ? (
            <div className="pt-2 border-t border-[#FDE4D8]">
              <p className="text-xs font-mono uppercase tracking-wider text-[#9E7756] mb-1.5">
                Interests
              </p>
              <p className="text-sm font-semibold text-[#3D2817]">
                {profile.interests.join(' · ')}
              </p>
            </div>
          ) : null}

          {!isSelfPreview && (onReport || onBlock) ? (
            <div className="pt-3 border-t border-[#FDE4D8] flex items-center justify-between gap-3">
              {onReport ? (
                <button
                  type="button"
                  onClick={onReport}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-[#F5C4A8] hover:bg-[#FFF8EC] text-xs font-bold text-[#7A5234] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-[#E8603A]" />
                  <span>Report</span>
                </button>
              ) : <span />}
              {onBlock ? (
                <button
                  type="button"
                  onClick={onBlock}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-[#F5C4A8] bg-[#FDE4D8]/60 hover:bg-[#FDE4D8] text-xs font-bold text-[#C44C29] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Block User</span>
                </button>
              ) : null}
            </div>
          ) : (
            <div className="pt-3 border-t border-[#FDE4D8] flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-xs font-bold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type SafetyTipCategory = 'all' | 'app' | 'in_person';

interface SafetyTipItem {
  title: string;
  description: string;
  icon: typeof ShieldCheck;
  tone: 'teal' | 'coral';
}

const APP_SAFETY_TIPS: SafetyTipItem[] = [
  {
    title: 'Keep conversations inside NearMatch at first',
    description:
      'Take your time getting to know someone in your private NearMatch chat before moving to personal messaging apps or sharing your phone number.',
    icon: MessageCircleHeart,
    tone: 'teal',
  },
  {
    title: 'Guard personal and financial details',
    description:
      'Never share passwords, one-time codes, banking details, or send money or gift cards—no matter how thoughtful or urgent someone sounds.',
    icon: Lock,
    tone: 'coral',
  },
  {
    title: 'Protect your daily routine and exact address',
    description:
      'NearMatch snaps your map location to roughly 300m so your street stays private. Hold off on sharing your home address, workplace, or daily schedule early on.',
    icon: EyeOff,
    tone: 'teal',
  },
  {
    title: 'Use Block & Report whenever you feel uneasy',
    description:
      'Open any profile or chat header to block or privately report someone. Blocking removes them from your discovery feed and immediately closes chat access.',
    icon: ShieldAlert,
    tone: 'coral',
  },
];

const IN_PERSON_SAFETY_TIPS: SafetyTipItem[] = [
  {
    title: 'Choose a bright, public spot for your first meetup',
    description:
      'Meet at a familiar café, daytime park, or lively neighborhood spot—and save private homes or secluded areas for later once real trust is built.',
    icon: Coffee,
    tone: 'coral',
  },
  {
    title: 'Share your plan with someone you trust',
    description:
      'Let a close friend or family member know who you are meeting, where you are going, and check in with them once you get home.',
    icon: HeartHandshake,
    tone: 'teal',
  },
  {
    title: 'Keep control of your own ride and pace',
    description:
      'Arrive and leave using your own transportation so you are always free to head home whenever you want without waiting on anyone else.',
    icon: Navigation,
    tone: 'teal',
  },
  {
    title: 'Stay mindful, charged, and trust your instincts',
    description:
      'Keep your phone charged, keep an eye on your drink and belongings, and remember it is always okay to wrap up a date early if anything feels off.',
    icon: PhoneCall,
    tone: 'coral',
  },
];

interface SafetyTipsModalProps {
  onClose: () => void;
}

export function SafetyTipsModal({ onClose }: SafetyTipsModalProps) {
  const [category, setCategory] = useState<SafetyTipCategory>('all');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const showAppTips = category === 'all' || category === 'app';
  const showInPersonTips = category === 'all' || category === 'in_person';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2B1A10]/65 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-tips-title"
    >
      <div
        className="bg-white border border-[#F5C4A8] rounded-3xl max-w-2xl w-full shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#FDE4D8] flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#DCF0EA] border border-[#A9D7C8] text-[#2E6B5C] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="safety-tips-title" className="text-xl sm:text-2xl font-bold text-[#3D2817]">
                Safety Tips &amp; Peaceful Dating
              </h3>
              <p className="text-sm text-[#7A5234] mt-0.5 leading-relaxed">
                Simple, thoughtful habits so you can meet great people around you with confidence.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-[#FFF8EC] flex items-center justify-center text-[#7A5234] shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8603A]"
            aria-label="Close safety tips modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-6 py-3 bg-[#FFF8EC]/70 border-b border-[#FDE4D8] shrink-0">
          <div
            className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-white border border-[#F5C4A8]"
            role="tablist"
            aria-label="Filter safety tips"
          >
            {(
              [
                { id: 'all', label: 'All Tips' },
                { id: 'app', label: 'Using the App' },
                { id: 'in_person', label: 'Meeting in Person' },
              ] as const
            ).map((tab) => {
              const active = category === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(tab.id)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#3D8C7A] text-white shadow-xs'
                      : 'text-[#7A5234] hover:text-[#3D2817] hover:bg-[#FFF8EC]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Advice Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-6">
          {showAppTips ? (
            <section className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-base font-bold text-[#3D2817]">Using NearMatch Safely</h4>
                <span className="text-xs font-semibold text-[#2E6B5C]">Before you meet</span>
              </div>
              <ul className="divide-y divide-[#FDE4D8]">
                {APP_SAFETY_TIPS.map((tip) => {
                  const Icon = tip.icon;
                  return (
                    <li key={tip.title} className="py-3.5 first:pt-1 last:pb-1 flex items-start gap-3.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          tip.tone === 'teal'
                            ? 'bg-[#DCF0EA] text-[#2E6B5C]'
                            : 'bg-[#FDE4D8] text-[#C44C29]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-[#3D2817]">{tip.title}</p>
                        <p className="text-sm text-[#7A5234] leading-relaxed">{tip.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {showInPersonTips ? (
            <section
              className={`space-y-3 ${showAppTips ? 'pt-5 border-t border-[#F5C4A8]' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-base font-bold text-[#3D2817]">Meeting in Person</h4>
                <span className="text-xs font-semibold text-[#C44C29]">First date checklist</span>
              </div>
              <ul className="divide-y divide-[#FDE4D8]">
                {IN_PERSON_SAFETY_TIPS.map((tip) => {
                  const Icon = tip.icon;
                  return (
                    <li key={tip.title} className="py-3.5 first:pt-1 last:pb-1 flex items-start gap-3.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          tip.tone === 'teal'
                            ? 'bg-[#DCF0EA] text-[#2E6B5C]'
                            : 'bg-[#FDE4D8] text-[#C44C29]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-[#3D2817]">{tip.title}</p>
                        <p className="text-sm text-[#7A5234] leading-relaxed">{tip.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <div className="rounded-2xl bg-[#FFF8EC] border border-[#F5C4A8] p-4 text-xs sm:text-sm text-[#7A5234] leading-relaxed">
            <span className="font-bold text-[#3D2817]">Need immediate help? </span>
            If you ever feel unsafe in person, move to a busy public space or contact local emergency services right away. You can always return here later to block or report any account.
          </div>
        </div>

        {/* Footer Action */}
        <div className="px-6 py-4 border-t border-[#FDE4D8] bg-[#FFF8EC]/60 flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-[#7A5234]">
            Your privacy and comfort always come first.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            Got it, thanks
          </button>
        </div>
      </div>
    </div>
  );
}
