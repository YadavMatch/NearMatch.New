import { Camera, IdCard, MessageCircle, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { VerificationStateSummary } from '../lib/identityVerification';
import type { UnifiedConversation } from '../types/models';
import { AvatarImage } from './AvatarImage';
import type { VerificationTab } from './IdentityVerificationModal';

interface MatchCelebrationModalProps {
  conversation: UnifiedConversation;
  viewerPhoto: string;
  viewerName: string;
  verificationStatus: VerificationStateSummary;
  onMessageNow: (conversation: UnifiedConversation) => void;
  onOpenVerification: (tab: VerificationTab) => void;
  onKeepSwiping: () => void;
}

export function MatchCelebrationModal({
  conversation,
  viewerPhoto,
  viewerName,
  verificationStatus,
  onMessageNow,
  onOpenVerification,
  onKeepSwiping,
}: MatchCelebrationModalProps) {
  const firstName = conversation.partnerName.split(' ')[0];

  return (
    <div className="fixed inset-0 z-50 bg-[#2B1A10]/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#F5C4A8] rounded-[28px] max-w-md w-full p-7 shadow-2xl relative text-center space-y-5">
        <button
          type="button"
          onClick={onKeepSwiping}
          className="absolute top-4 right-4 w-9 h-9 rounded-full hover:bg-[#FDE4D8]/60 flex items-center justify-center text-[#7A5234] cursor-pointer"
          aria-label="Close match dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.14em] text-[#E8603A] font-bold">
          <Sparkles className="w-4 h-4" />
          <span>It&apos;s a Match · {conversation.compatibilityScore}% Fit</span>
        </div>

        <div className="flex items-center justify-center -space-x-4 py-1">
          <AvatarImage
            src={viewerPhoto}
            name={viewerName}
            className="w-24 h-24 rounded-full border-4 border-[#FFF8EC] shadow-sm"
          />
          <AvatarImage
            src={conversation.partnerPhoto}
            name={conversation.partnerName}
            className="w-24 h-24 rounded-full border-4 border-[#FFF8EC] shadow-sm"
          />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#3D2817]">
            You and {firstName} liked each other
          </h2>
          <p className="text-sm text-[#7A5234]">
            {conversation.matchReasons.slice(0, 2).join(' · ') ||
              'Start a conversation while the spark is fresh.'}
          </p>
        </div>

        {verificationStatus.needsVerificationToChat ? (
          <div className="bg-[#FFF8EC] border border-[#F5C4A8] rounded-2xl p-4 text-left space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#2E6B5C] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#3D2817]">
                  {verificationStatus.reason === 'photo_change'
                    ? 'Photo Change Re-Verification Required to Chat'
                    : verificationStatus.reason === 'security_check'
                    ? 'Quick Security Check Required Before Chat'
                    : 'One-Time Real Identity & Age Verification Required to Chat'}
                </p>
                <p className="text-[11px] text-[#7A5234] leading-relaxed">
                  {verificationStatus.reason === 'photo_change'
                    ? 'Your profile pictures were updated. Complete Selfie Verification and Age Verification to unlock messaging.'
                    : verificationStatus.reason === 'security_check'
                    ? 'Complete a quick live selfie re-check to unlock your conversation.'
                    : 'Verify your age, real identity, and live selfie once so you can start chatting with matches.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onOpenVerification('profile_id')}
                className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  verificationStatus.isProfileVerified
                    ? 'bg-[#DCF0EA] border-[#A9D7C8] text-[#2E6B5C]'
                    : 'bg-[#E8603A] hover:bg-[#C44C29] border-[#E8603A] text-white'
                }`}
              >
                <IdCard className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {verificationStatus.isProfileVerified ? '1. Age & ID Verified' : '1. Age & Real ID'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onOpenVerification('selfie')}
                className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  verificationStatus.isSelfieVerified && !verificationStatus.securityCheckPending
                    ? 'bg-[#DCF0EA] border-[#A9D7C8] text-[#2E6B5C]'
                    : 'bg-[#3D8C7A] hover:bg-[#2E6B5C] border-[#3D8C7A] text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {verificationStatus.reason === 'photo_change' && !verificationStatus.isSelfieVerified
                    ? '2. Selfie Verification'
                    : verificationStatus.securityCheckPending
                    ? 'Run Selfie Check'
                    : verificationStatus.isSelfieVerified
                    ? '2. Selfie Verified'
                    : '2. Selfie Verification'}
                </span>
              </button>
            </div>
          </div>
        ) : null}

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={() => onMessageNow(conversation)}
            className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>
              {verificationStatus.needsVerificationToChat
                ? `Go to ${firstName}'s Chat`
                : `Message ${firstName}`}
            </span>
          </button>
          <button
            type="button"
            onClick={onKeepSwiping}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-2xl border border-[#F5C4A8] hover:bg-[#FFF8EC] text-sm font-bold text-[#7A5234] cursor-pointer"
          >
            Keep Discovering
          </button>
        </div>
      </div>
    </div>
  );
}
