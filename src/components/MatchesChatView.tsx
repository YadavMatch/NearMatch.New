import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  Camera,
  Check,
  CheckCheck,
  Coffee,
  Flag,
  HeartHandshake,
  IdCard,
  Lock,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserX,
  X,
} from 'lucide-react';
import { VOLUMETRIC_LIMITS } from '../lib/constants';
import { buildFallbackPartnerProfile, formatFriendlyActionError } from '../lib/blocking';
import { buildDateSpotSuggestions } from '../lib/dateIdeas';
import {
  blockUser,
  flagPeriodicSecurityCheck,
  markDemoMessagesRead,
  markLiveMessagesRead,
  recordChatOpenedForSecurityAudit,
  saveRealLifeCheckInInterests,
  sendDemoMessage,
  sendLiveMessage,
  submitReport,
  subscribeLiveMessages,
  unmatchConversation,
} from '../lib/firestoreService';
import {
  formatDayLabel,
  formatMessageTime,
  formatRelativeTime,
  generateClientId,
  isSameCalendarDay,
} from '../lib/format';
import { encryptVoiceBytes } from '../lib/voiceCrypto';
import { buildIcebreakerSuggestions } from '../lib/icebreakers';
import {
  getVerificationStatus,
  shouldTriggerPeriodicSecurityCheck,
} from '../lib/identityVerification';
import {
  buildSafetyCheckBody,
  getSafetyCheckAt,
  isSafetyCheckDue,
  SAFETY_CHECK_MESSAGE_ID,
  SAFETY_CHECK_SENDER_ID,
} from '../lib/safetyCheck';
import type {
  ChatMessage,
  DemoMatchRecord,
  PrivateAccount,
  PublicProfile,
  ReportReason,
  SwipeRecord,
  UnifiedConversation,
} from '../types/models';
import { AvatarImage } from './AvatarImage';
import type { VerificationTab } from './IdentityVerificationModal';
import {
  ConfirmActionModal,
  ProfileDetailModal,
  ReportModal,
  SafetyTipsModal,
} from './SafetyModals';
import { VoiceNoteBubble } from './VoiceNoteBubble';
import { VoiceRecorderBar } from './VoiceRecorderBar';

interface MatchesChatViewProps {
  viewer: PublicProfile;
  privateAccount: PrivateAccount;
  conversations: UnifiedConversation[];
  demoMatches: DemoMatchRecord[];
  swipes: SwipeRecord[];
  allCandidateProfiles: Map<string, PublicProfile>;
  firstMatchId: string | null;
  safetyCheckNowMs: number;
  selectedConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  onMarkConversationSeenLocally: (id: string) => void;
  onOpenVerification: (tab: VerificationTab) => void;
  onDiscoverClick: () => void;
}

export function MatchesChatView({
  viewer,
  privateAccount,
  conversations,
  demoMatches,
  swipes,
  allCandidateProfiles,
  firstMatchId,
  safetyCheckNowMs,
  selectedConversationId,
  onSelectConversation,
  onMarkConversationSeenLocally,
  onOpenVerification,
  onDiscoverClick,
}: MatchesChatViewProps) {
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSafetyTipsModal, setShowSafetyTipsModal] = useState(false);
  const [confirmKind, setConfirmKind] = useState<'unmatch' | 'block' | null>(null);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [icebreakerMode, setIcebreakerMode] = useState<'auto' | 'open' | 'closed'>('auto');
  const [showDateIdeas, setShowDateIdeas] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInSaving, setCheckInSaving] = useState(false);
  const [checkInDoneByChat, setCheckInDoneByChat] = useState<Record<string, boolean>>({});
  const [checkInFeedback, setCheckInFeedback] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchFilter, setMatchFilter] = useState<'all' | 'unread' | 'reply_needed' | 'new'>('all');
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const auditedChatIdsRef = useRef<Set<string>>(new Set());

  const verificationStatus = useMemo(
    () => getVerificationStatus(viewer, privateAccount),
    [viewer, privateAccount]
  );

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const isReplyNeeded = (c: UnifiedConversation) =>
    Boolean(c.lastMessageSenderId) &&
    c.lastMessageSenderId !== viewer.uid &&
    c.lastMessageSenderId !== SAFETY_CHECK_SENDER_ID;

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter((c) => {
      if (matchFilter === 'unread' && c.unreadCount === 0) return false;
      if (matchFilter === 'reply_needed' && !isReplyNeeded(c)) return false;
      if (matchFilter === 'new' && Boolean(c.lastMessageText)) return false;
      if (!q) return true;
      return (
        c.partnerName.toLowerCase().includes(q) ||
        c.partnerCity.toLowerCase().includes(q) ||
        c.partnerJobTitle.toLowerCase().includes(q)
      );
    });
  }, [conversations, searchQuery, matchFilter, viewer.uid]);

  const unreadThreadCount = useMemo(
    () => conversations.filter((c) => c.unreadCount > 0).length,
    [conversations]
  );

  const replyNeededThreadCount = useMemo(
    () => conversations.filter((c) => isReplyNeeded(c)).length,
    [conversations, viewer.uid]
  );

  const newMatches = useMemo(
    () => filteredConversations.filter((c) => !c.lastMessageText),
    [filteredConversations]
  );
  const activeThreads = useMemo(
    () => filteredConversations.filter((c) => Boolean(c.lastMessageText)),
    [filteredConversations]
  );

  useEffect(() => {
    setLiveMessages([]);
    setChatError(null);
    setVoiceActive(false);
    setIcebreakerMode('auto');
    setShowDateIdeas(false);
    setShowCheckIn(false);
    setCheckInFeedback(null);
    if (!selected) return;

    onMarkConversationSeenLocally(selected.id);

    // Periodic random security audit between conversations after initial verification
    if (
      verificationStatus.isFirstTimeVerified &&
      !verificationStatus.securityCheckPending &&
      !auditedChatIdsRef.current.has(selected.id)
    ) {
      auditedChatIdsRef.current.add(selected.id);
      const nextCount = (privateAccount.chatsSinceSecurityCheck ?? 0) + 1;
      const triggerCheck = shouldTriggerPeriodicSecurityCheck({
        isFirstTimeVerified: verificationStatus.isFirstTimeVerified,
        securityCheckPending: verificationStatus.securityCheckPending,
        chatsSinceSecurityCheck: nextCount,
        lastSecurityCheckAt: privateAccount.lastSecurityCheckAt,
      });
      if (triggerCheck) {
        void flagPeriodicSecurityCheck(viewer.uid);
      } else {
        void recordChatOpenedForSecurityAudit(viewer.uid, nextCount);
      }
    }

    if (selected.kind === 'demo') {
      const demo = demoMatches.find((d) => d.demoId === selected.id);
      if (demo) {
        void markDemoMessagesRead(viewer.uid, demo);
      }
      return;
    }

    const unsub = subscribeLiveMessages(
      selected.id,
      (msgs) => {
        setLiveMessages(msgs);
        onMarkConversationSeenLocally(selected.id);
        const unreadIds = msgs
          .filter((m) => m.recipientId === viewer.uid && !m.readAt && !m.pending)
          .map((m) => m.id);
        if (unreadIds.length > 0) {
          void markLiveMessagesRead(selected.id, unreadIds);
        }
      },
      (err) => setChatError(err.message)
    );

    return () => unsub();
  }, [selected?.id, selected?.kind, viewer.uid]);

  const displayedMessages: ChatMessage[] = useMemo(() => {
    if (!selected) return [];
    const baseMessages: ChatMessage[] =
      selected.kind === 'live'
        ? liveMessages
        : (demoMatches.find((d) => d.demoId === selected.id)?.messages ?? []).map((m) => ({
            id: m.id,
            matchId: selected.id,
            senderId: m.senderId,
            recipientId: m.senderId === viewer.uid ? selected.partnerUid : viewer.uid,
            body: m.body,
            kind: m.kind,
            voiceCiphertext: m.voiceCiphertext,
            voiceIv: m.voiceIv,
            voiceMimeType: m.voiceMimeType,
            voiceDurationSec: m.voiceDurationSec,
            clientId: m.id,
            sentAt: new Date(m.sentAtIso),
            readAt: m.readAtIso ? new Date(m.readAtIso) : undefined,
          }));

    const isFirstMatch = selected.id === firstMatchId;
    const due = isFirstMatch && isSafetyCheckDue(selected.matchedAt, safetyCheckNowMs);
    const alreadyHasSafetyCheck = baseMessages.some(
      (m) => m.id === SAFETY_CHECK_MESSAGE_ID || m.senderId === SAFETY_CHECK_SENDER_ID
    );

    if (!due || alreadyHasSafetyCheck) {
      return baseMessages;
    }

    const safetyMessage: ChatMessage = {
      id: SAFETY_CHECK_MESSAGE_ID,
      matchId: selected.id,
      senderId: SAFETY_CHECK_SENDER_ID,
      recipientId: viewer.uid,
      body: buildSafetyCheckBody(selected.partnerName),
      clientId: SAFETY_CHECK_MESSAGE_ID,
      sentAt: getSafetyCheckAt(selected.matchedAt),
    };

    return [...baseMessages, safetyMessage].sort(
      (a, b) => a.sentAt.getTime() - b.sentAt.getTime()
    );
  }, [selected, liveMessages, demoMatches, viewer.uid, firstMatchId, safetyCheckNowMs]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedMessages.length, selected?.id]);

  const sendMessageText = async (rawText: string, clearDraftOnSend: boolean): Promise<boolean> => {
    if (!selected || sending) return false;
    if (verificationStatus.needsVerificationToChat) {
      setChatError(
        verificationStatus.reason === 'photo_change'
          ? 'Profile pictures were updated — complete Selfie Verification and Age Verification below to resume chatting.'
          : verificationStatus.reason === 'security_check'
          ? 'Complete the periodic live selfie check below to continue chatting.'
          : 'Complete both Age & Real ID Verification and Live Selfie Verification once before starting chat.'
      );
      return false;
    }
    const body = rawText.trim();
    if (!body) return false;

    setSending(true);
    setChatError(null);
    if (clearDraftOnSend) {
      setDraft('');
    }
    try {
      if (selected.kind === 'live') {
        await sendLiveMessage({
          matchId: selected.id,
          senderId: viewer.uid,
          recipientId: selected.partnerUid,
          body,
        });
      } else {
        const demo = demoMatches.find((d) => d.demoId === selected.id);
        if (demo) {
          const partnerProfile = allCandidateProfiles.get(selected.partnerUid);
          const shared = partnerProfile
            ? partnerProfile.interests.filter((i) => viewer.interests.includes(i))
            : [];
          await sendDemoMessage({
            ownerId: viewer.uid,
            demoMatch: demo,
            body,
            sharedInterests: shared,
          });
        }
      }
      return true;
    } catch (err) {
      if (clearDraftOnSend) {
        setDraft(body);
      }
      setChatError(err instanceof Error ? err.message : 'Message failed to send.');
      return false;
    } finally {
      setSending(false);
    }
  };

  const sendVoiceMessage = async (payload: {
    audioBytes: Uint8Array;
    mimeType: string;
    durationSec: number;
  }): Promise<boolean> => {
    if (!selected || sending) return false;
    if (verificationStatus.needsVerificationToChat) {
      setChatError(
        verificationStatus.reason === 'photo_change'
          ? 'Profile pictures were updated — complete Selfie Verification and Age Verification below to resume chatting.'
          : verificationStatus.reason === 'security_check'
          ? 'Complete the periodic live selfie check below to continue chatting.'
          : 'Complete both Age & Real ID Verification and Live Selfie Verification once before starting chat.'
      );
      return false;
    }

    setSending(true);
    setChatError(null);
    try {
      const clientId = generateClientId();
      const voiceNote = await encryptVoiceBytes({
        audioBytes: payload.audioBytes,
        mimeType: payload.mimeType,
        durationSec: payload.durationSec,
        conversationId: selected.id,
        senderUid: viewer.uid,
        recipientUid: selected.partnerUid,
        clientId,
      });

      if (selected.kind === 'live') {
        await sendLiveMessage({
          matchId: selected.id,
          senderId: viewer.uid,
          recipientId: selected.partnerUid,
          body: '',
          clientId,
          voiceNote,
        });
      } else {
        const demo = demoMatches.find((d) => d.demoId === selected.id);
        if (demo) {
          const partnerProfile = allCandidateProfiles.get(selected.partnerUid);
          const shared = partnerProfile
            ? partnerProfile.interests.filter((i) => viewer.interests.includes(i))
            : [];
          await sendDemoMessage({
            ownerId: viewer.uid,
            demoMatch: demo,
            body: '',
            sharedInterests: shared,
            clientId,
            voiceNote,
          });
        }
      }
      return true;
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Encrypted voice note failed to send.');
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessageText(draft, true);
  };

  const handleUnmatchOrBlock = async () => {
    if (!selected || !confirmKind) return;
    setSafetyBusy(true);
    setChatError(null);
    const firstName = selected.partnerName.split(' ')[0];
    const kind = confirmKind;
    try {
      if (kind === 'unmatch') {
        await unmatchConversation({
          viewerUid: viewer.uid,
          kind: selected.kind,
          conversationId: selected.id,
        });
        setActionNotice(`Unmatched with ${firstName} and closed the conversation.`);
      } else {
        await blockUser({
          blockerId: viewer.uid,
          blockedId: selected.partnerUid,
          blockedName: selected.partnerName,
          activeLiveMatchId: selected.kind === 'live' ? selected.id : undefined,
          activeDemoMatchId: selected.kind === 'demo' ? selected.id : undefined,
        });
        setActionNotice(`${firstName} has been blocked and removed from active conversations.`);
      }
      setConfirmKind(null);
      setShowProfileModal(false);
      onSelectConversation(null);
    } catch (err) {
      setConfirmKind(null);
      setChatError(
        formatFriendlyActionError(
          err,
          kind === 'block'
            ? 'Unable to block user right now. Please try again.'
            : 'Unable to unmatch right now. Please try again.'
        )
      );
    } finally {
      setSafetyBusy(false);
    }
  };

  const handleReport = async (payload: {
    reason: ReportReason;
    details: string;
    alsoBlock: boolean;
  }) => {
    if (!selected) return;
    setSafetyBusy(true);
    setChatError(null);
    const firstName = selected.partnerName.split(' ')[0];
    try {
      await submitReport({
        reporterId: viewer.uid,
        reportedId: selected.partnerUid,
        reason: payload.reason,
        details: payload.details,
      });
      if (payload.alsoBlock) {
        await blockUser({
          blockerId: viewer.uid,
          blockedId: selected.partnerUid,
          blockedName: selected.partnerName,
          activeLiveMatchId: selected.kind === 'live' ? selected.id : undefined,
          activeDemoMatchId: selected.kind === 'demo' ? selected.id : undefined,
        });
        setActionNotice(`${firstName} was reported, blocked, and removed from active conversations.`);
        onSelectConversation(null);
      } else {
        setActionNotice(`Safety report submitted for ${firstName}.`);
      }
      setShowReportModal(false);
    } catch (err) {
      setShowReportModal(false);
      setChatError(
        formatFriendlyActionError(err, 'Unable to submit safety report right now. Please try again.')
      );
    } finally {
      setSafetyBusy(false);
    }
  };

  const partnerProfile = selected ? allCandidateProfiles.get(selected.partnerUid) ?? null : null;
  const effectivePartnerProfile = useMemo(() => {
    if (!selected) return null;
    return (
      partnerProfile ??
      buildFallbackPartnerProfile(selected, viewer.approxLat, viewer.approxLng)
    );
  }, [selected, partnerProfile, viewer.approxLat, viewer.approxLng]);

  const viewerHasMessaged = useMemo(
    () => displayedMessages.some((m) => m.senderId === viewer.uid),
    [displayedMessages, viewer.uid]
  );

  const icebreakers = useMemo(() => {
    if (!selected) return [];
    return buildIcebreakerSuggestions({
      viewerInterests: viewer.interests,
      partnerInterests: partnerProfile?.interests ?? [],
      matchReasons: selected.matchReasons,
      partnerName: selected.partnerName,
      partnerCity: selected.partnerCity,
      conversationId: selected.id,
      maxCount: 3,
    });
  }, [selected, viewer.interests, partnerProfile?.interests]);

  const dateIdeas = useMemo(() => {
    if (!selected) return [];
    return buildDateSpotSuggestions({
      viewerInterests: viewer.interests,
      partnerInterests: partnerProfile?.interests ?? [],
      matchReasons: selected.matchReasons,
      partnerName: selected.partnerName,
      partnerCity: selected.partnerCity,
      maxCount: 3,
    });
  }, [selected, viewer.interests, partnerProfile?.interests]);

  const lastDisplayedMessage = displayedMessages[displayedMessages.length - 1] ?? null;
  const showQuickReplies =
    Boolean(selected) &&
    Boolean(lastDisplayedMessage) &&
    lastDisplayedMessage.senderId !== viewer.uid &&
    lastDisplayedMessage.senderId !== SAFETY_CHECK_SENDER_ID;

  const hasCommonIcebreaker = icebreakers.some((item) => item.isCommonInterest);
  const icebreakersVisible =
    !showDateIdeas &&
    icebreakers.length > 0 &&
    (icebreakerMode === 'open' || (icebreakerMode === 'auto' && !viewerHasMessaged));

  const attachedSparkNote = useMemo(() => {
    if (!selected) return undefined;
    return swipes.find((s) => s.targetId === selected.partnerUid && Boolean(s.note))?.note;
  }, [selected, swipes]);

  const handleRealLifeCheckIn = async (outcome: 'met_great' | 'met_neutral' | 'chat_only') => {
    if (!selected || checkInSaving) return;
    setCheckInSaving(true);
    try {
      if (outcome === 'met_great' && partnerProfile) {
        const merged = Array.from(
          new Set([
            ...(privateAccount.preferredInterests ?? []),
            ...partnerProfile.interests.slice(0, 4),
          ])
        );
        await saveRealLifeCheckInInterests(viewer.uid, merged);
      }
      setCheckInDoneByChat((prev) => ({ ...prev, [selected.id]: true }));
      setShowCheckIn(false);
      setCheckInFeedback(
        outcome === 'met_great'
          ? 'Saved privately — future Discover picks will lean toward shared qualities.'
          : 'Thank you — your private check-in helps tune NearMatch quietly.'
      );
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to save check-in feedback.');
    } finally {
      setCheckInSaving(false);
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        {actionNotice ? (
          <div className="px-4 py-3 rounded-2xl bg-[#DCF0EA] border border-[#A9D7C8] text-xs font-bold text-[#2E6B5C] flex items-center justify-between gap-3">
            <span>{actionNotice}</span>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        ) : null}
        <div className="bg-white border border-[#F5C4A8] rounded-[28px] p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#FDE4D8] text-[#E8603A] flex items-center justify-center mx-auto">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-[#3D2817]">No matches yet</h2>
          <p className="text-sm text-[#7A5234] leading-relaxed">
            When you and another member both swipe right or send a Super Like, your match and real-time chat appear here automatically.
          </p>
          <button
            type="button"
            onClick={onDiscoverClick}
            className="min-h-[44px] px-6 py-2.5 rounded-2xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-sm font-bold cursor-pointer"
          >
            Back to Discovery
          </button>
        </div>
      </div>
    );
  }

  const handleSendIcebreaker = async (question: string) => {
    const sent = await sendMessageText(question, false);
    if (sent) {
      setIcebreakerMode('auto');
    }
  };

  const handleSendDateIdea = async (inviteText: string) => {
    const sent = await sendMessageText(inviteText, false);
    if (sent) {
      setShowDateIdeas(false);
    }
  };

  return (
    <div className="space-y-4">
      {actionNotice ? (
        <div className="px-4 py-3 rounded-2xl bg-[#DCF0EA] border border-[#A9D7C8] text-xs font-bold text-[#2E6B5C] flex items-center justify-between gap-3">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]">
      {/* Left Pane: New Matches & Conversations List */}
      <section
        className={`lg:col-span-4 bg-white border border-[#F5C4A8] rounded-3xl flex flex-col overflow-hidden shadow-[0_2px_8px_rgba(61,40,23,0.06)] ${
          selected ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-[#FDE4D8] space-y-3">
          <div>
            <h2 className="text-xl font-bold text-[#3D2817]">Matches</h2>
            <p className="text-xs text-[#7A5234] mt-0.5">
              {conversations.length} active connection{conversations.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-[#9E7756] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search matches or city..."
              aria-label="Search matches"
              className="w-full min-h-[40px] pl-9 pr-8 py-2 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-xs font-medium text-[#3D2817] focus:outline-none focus:border-[#E8603A] focus:bg-white"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear match search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md hover:bg-[#FDE4D8] text-[#7A5234] flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="tablist" aria-label="Filter matches">
            {(
              [
                { id: 'all', label: `All (${conversations.length})` },
                { id: 'reply_needed', label: `Reply (${replyNeededThreadCount})` },
                { id: 'unread', label: `Unread (${unreadThreadCount})` },
                { id: 'new', label: `New (${conversations.filter((c) => !c.lastMessageText).length})` },
              ] as const
            ).map((tab) => {
              const active = matchFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMatchFilter(tab.id)}
                  className={`min-h-[36px] px-2 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#E8603A] text-white'
                      : 'bg-[#FFF8EC] text-[#7A5234] border border-[#F5C4A8] hover:border-[#E8603A]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {newMatches.length > 0 ? (
          <div className="p-4 border-b border-[#FDE4D8] space-y-2.5">
            <p className="text-xs font-mono uppercase tracking-wider text-[#E8603A] font-semibold">
              New Matches
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {newMatches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectConversation(m.id)}
                  className="shrink-0 w-16 text-center space-y-1 cursor-pointer group"
                >
                  <AvatarImage
                    src={m.partnerPhoto}
                    name={m.partnerName}
                    className={`w-16 h-16 rounded-2xl border-2 transition-colors ${
                      selected?.id === m.id
                        ? 'border-[#E8603A]'
                        : 'border-transparent group-hover:border-[#F5C4A8]'
                    }`}
                  />
                  <p className="text-xs font-bold text-[#3D2817] truncate">
                    {m.partnerName.split(' ')[0]}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto divide-y divide-[#FDE4D8]">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center space-y-2.5">
              <p className="text-sm font-bold text-[#3D2817]">No matching threads</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setMatchFilter('all');
                }}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#FFF8EC] border border-[#F5C4A8] hover:border-[#E8603A] text-xs font-bold text-[#7A5234] cursor-pointer"
              >
                Reset search &amp; filters
              </button>
            </div>
          ) : (
            (activeThreads.length > 0 ? activeThreads : filteredConversations).map((conv) => {
              const isSelected = selected?.id === conv.id;
              const replyNeeded = isReplyNeeded(conv);
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => onSelectConversation(conv.id)}
                  className={`w-full p-4 text-left flex items-center gap-3 transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#FFF8EC]' : 'hover:bg-[#FFF8EC]/60'
                  }`}
                >
                  <AvatarImage
                    src={conv.partnerPhoto}
                    name={conv.partnerName}
                    className="w-12 h-12 rounded-xl shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-[#3D2817] truncate">
                        {conv.partnerName}
                      </p>
                      <span className="text-[11px] font-mono text-[#9E7756] shrink-0">
                        {formatRelativeTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-[#7A5234] truncate">
                        {conv.lastMessageText || 'Matched — say hello!'}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {replyNeeded ? (
                          <span className="text-[10px] font-mono font-bold text-[#E8603A]">
                            Reply needed
                          </span>
                        ) : null}
                        {conv.unreadCount > 0 ? (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#E8603A] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Right Pane: Real-Time Message Thread */}
      <section
        className={`lg:col-span-8 bg-white border border-[#F5C4A8] rounded-3xl flex flex-col overflow-hidden shadow-[0_2px_8px_rgba(61,40,23,0.06)] ${
          selected ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {selected ? (
          <>
            <header className="px-4 sm:px-5 py-3.5 border-b border-[#FDE4D8] flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectConversation(null)}
                  className="lg:hidden min-w-[40px] min-h-[40px] rounded-xl hover:bg-[#FFF8EC] flex items-center justify-center text-[#3D2817] cursor-pointer"
                  aria-label="Back to matches"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => effectivePartnerProfile && setShowProfileModal(true)}
                  className="flex items-center gap-3 min-w-0 text-left cursor-pointer group"
                >
                  <AvatarImage
                    src={selected.partnerPhoto}
                    name={selected.partnerName}
                    className="w-10 h-10 rounded-xl shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#3D2817] group-hover:underline truncate">
                      {selected.partnerName}, {selected.partnerAge}
                    </p>
                    <p className="text-xs text-[#2E6B5C] font-medium truncate">
                      {selected.compatibilityScore}% compatible · {selected.partnerCity}
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {effectivePartnerProfile ? (
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(true)}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-lg hover:bg-[#FFF8EC] text-xs font-bold text-[#3D2817] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    title="View profile"
                  >
                    <UserRound className="w-3.5 h-3.5 text-[#3D8C7A] shrink-0" />
                    <span className="hidden md:inline">Profile</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowCheckIn((prev) => !prev)}
                  className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                    showCheckIn
                      ? 'bg-[#DCF0EA] text-[#2E6B5C]'
                      : 'hover:bg-[#FFF8EC] text-[#7A5234]'
                  }`}
                  title="Real-Life Check-In"
                >
                  <HeartHandshake className="w-3.5 h-3.5 text-[#E8603A] shrink-0" />
                  <span className="hidden md:inline">Check-In</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSafetyTipsModal(true)}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-lg hover:bg-[#DCF0EA]/60 text-xs font-bold text-[#2E6B5C] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  title="Safety guidelines"
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden md:inline">Safety</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-lg hover:bg-[#FFF8EC] text-xs font-bold text-[#7A5234] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  title="Report user"
                >
                  <Flag className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmKind('block')}
                  aria-label="Block User"
                  className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#F5C4A8] bg-[#FDE4D8]/55 hover:bg-[#FDE4D8] text-xs font-bold text-[#C44C29] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                  title="Block User"
                >
                  <Ban className="w-3.5 h-3.5 shrink-0" />
                  <span>Block User</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmKind('unmatch')}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#F5C4A8] hover:bg-[#FFF8EC] text-xs font-bold text-[#7A5234] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  title="Unmatch"
                >
                  <UserX className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Unmatch</span>
                </button>
              </div>
            </header>

            {chatError ? (
              <div className="px-5 py-2.5 bg-[#FEECEB] text-xs font-semibold text-[#C0392B] border-b border-[#F5C2C0]">
                {chatError}
              </div>
            ) : null}

            {checkInFeedback ? (
              <div className="px-5 py-2.5 bg-[#DCF0EA] text-xs font-bold text-[#2E6B5C] border-b border-[#A9D7C8] flex items-center justify-between gap-2">
                <span>{checkInFeedback}</span>
                <button
                  type="button"
                  onClick={() => setCheckInFeedback(null)}
                  className="underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            {showCheckIn ? (
              <div className="px-5 py-4 bg-[#FFF8EC] border-b border-[#F5C4A8] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-[#2E6B5C] font-semibold">
                      Confidential Real-Life Check-In
                    </p>
                    <p className="text-xs font-bold text-[#3D2817] mt-0.5">
                      Did you meet {selected.partnerName.split(' ')[0]} in person yet?
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCheckIn(false)}
                    aria-label="Close check-in"
                    className="w-7 h-7 rounded-lg hover:bg-white text-[#7A5234] flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={checkInSaving || Boolean(checkInDoneByChat[selected.id])}
                    onClick={() => void handleRealLifeCheckIn('met_great')}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#3D8C7A] hover:bg-[#2E6B5C] text-white text-xs font-bold cursor-pointer disabled:opacity-55"
                  >
                    Yes — great connection
                  </button>
                  <button
                    type="button"
                    disabled={checkInSaving || Boolean(checkInDoneByChat[selected.id])}
                    onClick={() => void handleRealLifeCheckIn('met_neutral')}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl border border-[#F5C4A8] bg-white hover:bg-[#FDE4D8]/50 text-xs font-bold text-[#3D2817] cursor-pointer disabled:opacity-55"
                  >
                    Yes — not a match
                  </button>
                  <button
                    type="button"
                    disabled={checkInSaving || Boolean(checkInDoneByChat[selected.id])}
                    onClick={() => void handleRealLifeCheckIn('chat_only')}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl border border-[#F5C4A8] bg-white hover:bg-[#FDE4D8]/50 text-xs font-bold text-[#7A5234] cursor-pointer disabled:opacity-55"
                  >
                    Still chatting online
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#FFF8EC]/60">
              <div className="text-center py-2">
                <p className="text-xs text-[#9E7756]">
                  Matched on {selected.matchedAt.toLocaleDateString()} ·{' '}
                  {selected.matchReasons[0] ?? `${selected.compatibilityScore}% compatible`}
                </p>
              </div>

              {attachedSparkNote ? (
                <div className="max-w-md mx-auto rounded-2xl bg-white border border-[#F5C4A8] p-3.5 space-y-1 shadow-xs">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-[#E8603A] font-semibold">
                    Spark Note Sent With Your Like
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-[#3D2817]">
                    &ldquo;{attachedSparkNote}&rdquo;
                  </p>
                </div>
              ) : null}

              {displayedMessages.map((msg, idx) => {
                const isSafetyCheck = msg.senderId === SAFETY_CHECK_SENDER_ID;
                const isMine = msg.senderId === viewer.uid;
                const prev = idx > 0 ? displayedMessages[idx - 1] : null;
                const showDayDivider = !prev || !isSameCalendarDay(prev.sentAt, msg.sentAt);

                return (
                  <React.Fragment key={msg.id}>
                    {showDayDivider ? (
                      <div className="flex justify-center py-2">
                        <span className="text-[11px] font-mono text-[#9E7756]">
                          {formatDayLabel(msg.sentAt)}
                        </span>
                      </div>
                    ) : null}

                    {isSafetyCheck ? (
                      <div className="py-1.5 flex justify-center">
                        <div className="max-w-md w-full rounded-2xl bg-[#DCF0EA]/75 border border-[#A9D7C8] p-4 space-y-2.5 shadow-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2E6B5C]">
                              <ShieldCheck className="w-4 h-4 shrink-0" />
                              <span>Safety Check</span>
                            </span>
                            <span className="text-[10px] font-mono text-[#2E6B5C]/80">
                              24h follow-up · {formatMessageTime(msg.sentAt)}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-[#3D2817] leading-relaxed">
                            {msg.body}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => setShowSafetyTipsModal(true)}
                              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white hover:bg-[#FFF8EC] border border-[#A9D7C8] text-xs font-bold text-[#2E6B5C] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                              <span>Safety Guidelines</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowReportModal(true)}
                              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white hover:bg-[#FDE4D8]/60 border border-[#F5C4A8] text-xs font-bold text-[#C44C29] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                            >
                              <Flag className="w-3.5 h-3.5 shrink-0" />
                              <span>Report Tool</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[78%] sm:max-w-[68%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isMine
                              ? 'bg-[#E8603A] text-white rounded-br-sm shadow-sm'
                              : 'bg-white border border-[#F5C4A8] text-[#3D2817] rounded-bl-sm'
                          }`}
                        >
                          {msg.kind === 'voice' && msg.voiceCiphertext && msg.voiceIv ? (
                            <VoiceNoteBubble
                              message={msg}
                              conversationId={selected.id}
                              isMine={isMine}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                          )}
                          <div
                            className={`mt-1 flex items-center justify-end gap-1 text-[10px] font-mono ${
                              isMine ? 'text-white/80' : 'text-[#9E7756]'
                            }`}
                          >
                            <span>{formatMessageTime(msg.sentAt)}</span>
                            {isMine ? (
                              msg.pending ? (
                                <span>· Sending</span>
                              ) : msg.readAt ? (
                                <CheckCheck className="w-3 h-3 text-[#DCF0EA]" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              <div ref={scrollEndRef} />
            </div>

            {verificationStatus.needsVerificationToChat ? (
              <div className="p-4 sm:p-5 border-t border-[#F5C4A8] bg-[#FFF8EC] space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FDE4D8] border border-[#F5C4A8] text-[#C44C29] flex items-center justify-center shrink-0">
                    {verificationStatus.reason === 'security_check' ||
                    verificationStatus.reason === 'photo_change' ? (
                      <ShieldAlert className="w-5 h-5" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-bold text-[#3D2817]">
                      {verificationStatus.reason === 'photo_change'
                        ? 'Profile Pictures Updated — Re-Verification Required'
                        : verificationStatus.reason === 'security_check'
                        ? 'Security Check Required Before Continuing Chat'
                        : 'Verify Your Real Identity & Age Once to Start This Conversation'}
                    </p>
                    <p className="text-xs text-[#7A5234] leading-relaxed">
                      {verificationStatus.reason === 'photo_change'
                        ? 'Whenever profile pictures are changed, complete both Selfie Verification (live camera) and Age Verification (18+ ID) to resume messaging.'
                        : verificationStatus.reason === 'security_check'
                        ? 'For member safety, NearMatch triggers occasional random selfie re-checks between chats. Complete your live selfie check to resume messaging.'
                        : 'Complete both Age & Real ID Verification and Selfie Verification (Live Check) one time to unlock messaging with matches. Periodic random checks may occur later.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenVerification('profile_id')}
                    className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                      verificationStatus.isProfileVerified
                        ? 'bg-[#DCF0EA] border-[#A9D7C8] text-[#2E6B5C]'
                        : 'bg-[#E8603A] hover:bg-[#C44C29] border-[#E8603A] text-white'
                    }`}
                  >
                    <IdCard className="w-4 h-4 shrink-0" />
                    <span>
                      {verificationStatus.isProfileVerified
                        ? '1. Age & ID Verified'
                        : '1. Age & Real ID Verification'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenVerification('selfie')}
                    className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                      verificationStatus.isSelfieVerified && !verificationStatus.securityCheckPending
                        ? 'bg-[#DCF0EA] border-[#A9D7C8] text-[#2E6B5C]'
                        : 'bg-[#3D8C7A] hover:bg-[#2E6B5C] border-[#3D8C7A] text-white'
                    }`}
                  >
                    <Camera className="w-4 h-4 shrink-0" />
                    <span>
                      {verificationStatus.reason === 'photo_change' && !verificationStatus.isSelfieVerified
                        ? '2. Selfie Verification'
                        : verificationStatus.securityCheckPending
                        ? 'Run Security Selfie Check'
                        : verificationStatus.isSelfieVerified
                        ? '2. Selfie Verified'
                        : '2. Selfie Verification'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {showDateIdeas && dateIdeas.length > 0 ? (
                  <div className="px-4 py-3 border-t border-[#FDE4D8] bg-[#DCF0EA]/35 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#2E6B5C]">
                        <Coffee className="w-3.5 h-3.5 shrink-0" />
                        <span>Public Date Spot Ideas</span>
                        <span className="font-semibold text-[#7A5234]">· Edit or send invite</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDateIdeas(false)}
                        aria-label="Hide date spot ideas"
                        className="w-7 h-7 rounded-lg hover:bg-white text-[#7A5234] flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {dateIdeas.map((spot) => (
                        <div
                          key={spot.id}
                          className="rounded-2xl bg-white border border-[#A9D7C8] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-[11px] font-mono font-semibold text-[#2E6B5C]">
                              {spot.title} · {spot.vibe}
                            </p>
                            <p className="text-xs font-semibold text-[#3D2817] leading-snug">
                              {spot.inviteText}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setDraft(spot.inviteText);
                                setShowDateIdeas(false);
                              }}
                              className="min-h-[36px] px-2.5 py-1 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] hover:bg-[#FDE4D8]/60 text-xs font-bold text-[#7A5234] whitespace-nowrap cursor-pointer"
                            >
                              Edit draft
                            </button>
                            <button
                              type="button"
                              disabled={sending}
                              onClick={() => void handleSendDateIdea(spot.inviteText)}
                              className="min-h-[36px] px-3 py-1 rounded-xl bg-[#3D8C7A] hover:bg-[#2E6B5C] text-white text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-55"
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {icebreakersVisible ? (
                  <div className="px-4 py-3 border-t border-[#FDE4D8] bg-[#FFF8EC]/90 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#3D2817]">
                        <Sparkles className="w-3.5 h-3.5 text-[#E8603A] shrink-0" />
                        <span>
                          {hasCommonIcebreaker
                            ? 'Common-interest icebreakers'
                            : 'Conversation icebreakers'}
                        </span>
                        <span className="font-semibold text-[#9E7756]">· Tap to send</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIcebreakerMode('closed')}
                        aria-label="Hide icebreaker suggestions"
                        className="w-7 h-7 rounded-lg hover:bg-[#FDE4D8]/70 text-[#7A5234] flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      {icebreakers.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          disabled={sending}
                          onClick={() => void handleSendIcebreaker(item.question)}
                          className="w-full text-left px-3.5 py-2.5 rounded-2xl bg-white hover:bg-[#FDE4D8]/35 border border-[#F5C4A8] hover:border-[#E8603A] transition-colors flex items-center justify-between gap-3 cursor-pointer disabled:opacity-55 group"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p
                              className={`text-[11px] font-mono font-semibold uppercase tracking-wider ${
                                item.isCommonInterest ? 'text-[#2E6B5C]' : 'text-[#9E7756]'
                              }`}
                            >
                              {item.interest ? `Shared: ${item.interest}` : 'Local starter'}
                            </p>
                            <p className="text-xs sm:text-sm font-semibold text-[#3D2817] leading-snug">
                              {item.question}
                            </p>
                          </div>
                          <Send className="w-3.5 h-3.5 text-[#9E7756] group-hover:text-[#E8603A] shrink-0 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {showQuickReplies && !icebreakersVisible && !showDateIdeas ? (
                  <div className="px-3 sm:px-4 pt-2.5 pb-1 border-t border-[#FDE4D8] bg-white flex items-center gap-2 overflow-x-auto">
                    <span className="text-[11px] font-mono text-[#9E7756] shrink-0">Quick reply:</span>
                    {[
                      'That sounds lovely!',
                      'Are you free this weekend?',
                      'Tell me more about that',
                    ].map((reply) => (
                      <button
                        key={reply}
                        type="button"
                        disabled={sending}
                        onClick={() => void sendMessageText(reply, false)}
                        className="min-h-[34px] px-3 py-1 rounded-xl bg-[#FFF8EC] hover:bg-[#FDE4D8]/60 border border-[#F5C4A8] text-xs font-bold text-[#3D2817] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-55"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                ) : null}

                <form
                  onSubmit={handleSend}
                  className="p-3 sm:p-4 border-t border-[#FDE4D8] bg-white flex items-center gap-2"
                >
                  {!voiceActive ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDateIdeas(false);
                          setIcebreakerMode(icebreakersVisible ? 'closed' : 'open');
                        }}
                        aria-label="Toggle icebreaker suggestions"
                        aria-expanded={icebreakersVisible}
                        title={
                          icebreakersVisible
                            ? 'Hide icebreakers'
                            : 'Suggest icebreaker questions'
                        }
                        className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                          icebreakersVisible
                            ? 'bg-[#FDE4D8] border-[#E8603A] text-[#C44C29]'
                            : 'bg-[#FFF8EC] border-[#F5C4A8] hover:border-[#E8603A] text-[#7A5234]'
                        }`}
                      >
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">Icebreakers</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIcebreakerMode('closed');
                          setShowDateIdeas((prev) => !prev);
                        }}
                        aria-label="Toggle public date spot suggestions"
                        aria-expanded={showDateIdeas}
                        title="Suggest a safe public meetup"
                        className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                          showDateIdeas
                            ? 'bg-[#DCF0EA] border-[#3D8C7A] text-[#2E6B5C]'
                            : 'bg-[#FFF8EC] border-[#F5C4A8] hover:border-[#3D8C7A] text-[#7A5234]'
                        }`}
                      >
                        <Coffee className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">Date Ideas</span>
                      </button>
                    </>
                  ) : null}

                  <VoiceRecorderBar
                    conversationId={selected.id}
                    disabled={verificationStatus.needsVerificationToChat}
                    sending={sending}
                    onRecordingStateChange={setVoiceActive}
                    onError={setChatError}
                    onSendVoiceNote={sendVoiceMessage}
                  />

                  {!voiceActive ? (
                    <>
                      <input
                        type="text"
                        maxLength={VOLUMETRIC_LIMITS.MAX_MESSAGE_LEN}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={`Write to ${selected.partnerName.split(' ')[0]}...`}
                        className="flex-1 min-w-0 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-sm text-[#3D2817] focus:outline-none focus:border-[#E8603A] focus:bg-white"
                      />
                      <button
                        type="submit"
                        disabled={!draft.trim() || sending}
                        className="min-h-[44px] min-w-[44px] px-4 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] disabled:opacity-45 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                        aria-label="Send message"
                      >
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:inline">Send</span>
                      </button>
                    </>
                  ) : null}
                </form>
              </>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
            <p className="text-xl font-bold text-[#3D2817]">
              Select a match to open the conversation
            </p>
            <p className="text-sm text-[#7A5234] max-w-sm">
              Real-time Firestore listeners deliver messages and read receipts instantaneously.
            </p>
          </div>
        )}
      </section>

      </div>

      {showProfileModal && effectivePartnerProfile ? (
        <ProfileDetailModal
          profile={effectivePartnerProfile}
          viewerLat={viewer.approxLat}
          viewerLng={viewer.approxLng}
          onClose={() => setShowProfileModal(false)}
          onBlock={() => {
            setShowProfileModal(false);
            setConfirmKind('block');
          }}
          onReport={() => {
            setShowProfileModal(false);
            setShowReportModal(true);
          }}
        />
      ) : null}

      {showReportModal && selected ? (
        <ReportModal
          targetName={selected.partnerName}
          busy={safetyBusy}
          onSubmit={handleReport}
          onClose={() => setShowReportModal(false)}
        />
      ) : null}

      {showSafetyTipsModal ? (
        <SafetyTipsModal onClose={() => setShowSafetyTipsModal(false)} />
      ) : null}

      {confirmKind && selected ? (
        <ConfirmActionModal
          title={
            confirmKind === 'unmatch'
              ? `Unmatch ${selected.partnerName.split(' ')[0]}?`
              : `Block ${selected.partnerName.split(' ')[0]}?`
          }
          description={
            confirmKind === 'unmatch'
              ? 'This permanently closes the match thread so neither side can send further messages.'
              : 'Blocking updates your blocked list, removes this member from active conversations, and prevents future discovery or messaging.'
          }
          confirmLabel={confirmKind === 'unmatch' ? 'Unmatch' : 'Block User'}
          destructive
          busy={safetyBusy}
          onConfirm={handleUnmatchOrBlock}
          onCancel={() => setConfirmKind(null)}
        />
      ) : null}
    </div>
  );
}
