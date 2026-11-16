import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Eye,
  Flag,
  Heart,
  Info,
  MapPin,
  MessageCircle,
  MessageSquarePlus,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { VOLUMETRIC_LIMITS } from '../lib/constants';
import { formatFriendlyActionError } from '../lib/blocking';
import { filterRankedCandidates, type DiscoverDeckFilter } from '../lib/dateIdeas';
import {
  blockUser,
  recordSwipe,
  submitReport,
  undoSwipe,
  updateDiscoveryPreferences,
} from '../lib/firestoreService';
import { formatRelativeTime } from '../lib/format';
import { displayDistance } from '../lib/matching';
import type {
  PrivateAccount,
  PublicProfile,
  RankedCandidate,
  ReportReason,
  SwipeAction,
  SwipeRecord,
  UnifiedConversation,
} from '../types/models';
import { AvatarImage } from './AvatarImage';
import { DailyNearMatchPulse } from './DailyNearMatchPulse';
import { ConfirmActionModal, ProfileDetailModal, ReportModal } from './SafetyModals';

interface DiscoverViewProps {
  viewer: PublicProfile;
  privateAccount: PrivateAccount;
  rankedCandidates: RankedCandidate[];
  dailyMutualPick: RankedCandidate | null;
  curatedHighlights: RankedCandidate[];
  replyNeededCount: number;
  swipes: SwipeRecord[];
  allCandidateProfiles: Map<string, PublicProfile>;
  conversations: UnifiedConversation[];
  existingLiveMatchIds: Set<string>;
  onMatchCreated: (conversation: UnifiedConversation) => void;
  onOpenChat: (conversationId: string) => void;
  onOpenReplies: () => void;
  onOpenPreferences: () => void;
}

interface RecentSwipe {
  swipeId: string;
  targetName: string;
  action: SwipeAction;
  matched: boolean;
  createdAtMs: number;
}

const QUICK_RADIUS_OPTIONS = [10, 25, 50, 100] as const;

export function DiscoverView({
  viewer,
  privateAccount,
  rankedCandidates,
  dailyMutualPick,
  curatedHighlights,
  replyNeededCount,
  swipes,
  allCandidateProfiles,
  conversations,
  existingLiveMatchIds,
  onMatchCreated,
  onOpenChat,
  onOpenReplies,
  onOpenPreferences,
}: DiscoverViewProps) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [deckFilter, setDeckFilter] = useState<DiscoverDeckFilter>('all');
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [sparkNote, setSparkNote] = useState('');
  const [busyAction, setBusyAction] = useState<SwipeAction | 'undo' | null>(null);
  const [radiusBusy, setRadiusBusy] = useState(false);
  const [recentSwipe, setRecentSwipe] = useState<RecentSwipe | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [inspectProfile, setInspectProfile] = useState<PublicProfile | null>(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [undoingSwipeId, setUndoingSwipeId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<PublicProfile | null>(null);
  const [blockTarget, setBlockTarget] = useState<PublicProfile | null>(null);
  const [safetyBusy, setSafetyBusy] = useState(false);

  const filteredCandidates = useMemo(
    () => filterRankedCandidates(rankedCandidates, deckFilter),
    [rankedCandidates, deckFilter]
  );

  const filterCounts = useMemo(
    () => ({
      all: rankedCandidates.length,
      high_match: filterRankedCandidates(rankedCandidates, 'high_match').length,
      shared_interests: filterRankedCandidates(rankedCandidates, 'shared_interests').length,
      nearby_10km: filterRankedCandidates(rankedCandidates, 'nearby_10km').length,
    }),
    [rankedCandidates]
  );

  const activeCandidate = filteredCandidates[0] ?? null;

  useEffect(() => {
    setPhotoIdx(0);
    setShowNoteComposer(false);
    setSparkNote('');
  }, [activeCandidate?.profile.uid]);

  const canUndo =
    recentSwipe !== null &&
    !recentSwipe.matched &&
    Date.now() - recentSwipe.createdAtMs <= VOLUMETRIC_LIMITS.UNDO_WINDOW_MS;

  const conversationByPartner = useMemo(() => {
    const map = new Map<string, UnifiedConversation>();
    for (const c of conversations) {
      map.set(c.partnerUid, c);
    }
    return map;
  }, [conversations]);

  const sortedSwipes = useMemo(
    () => [...swipes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [swipes]
  );

  const handleSwipe = async (
    action: SwipeAction,
    targetCandidate?: RankedCandidate,
    explicitNote?: string
  ) => {
    const target = targetCandidate ?? activeCandidate;
    if (!target || busyAction) return;
    setBusyAction(action);
    setFeedback(null);
    const noteToAttach =
      action !== 'pass'
        ? (explicitNote ?? (target.profile.uid === activeCandidate?.profile.uid ? sparkNote : '')).trim()
        : undefined;

    try {
      const res = await recordSwipe({
        viewer,
        ranked: target,
        action,
        existingMatchIds: existingLiveMatchIds,
        note: noteToAttach || undefined,
      });

      setRecentSwipe({
        swipeId: res.swipeId,
        targetName: target.profile.displayName,
        action,
        matched: res.matched,
        createdAtMs: Date.now(),
      });

      if (target.profile.uid === activeCandidate?.profile.uid) {
        setSparkNote('');
        setShowNoteComposer(false);
      }

      if (res.matched && res.conversation) {
        onMatchCreated(res.conversation);
      } else if (action === 'superlike') {
        setFeedback(`Super Like sent to ${target.profile.displayName.split(' ')[0]}.`);
      } else if (noteToAttach) {
        setFeedback(`Spark Note & Like sent to ${target.profile.displayName.split(' ')[0]}.`);
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to record swipe.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleUndo = async () => {
    if (!canUndo || !recentSwipe || busyAction) return;
    setBusyAction('undo');
    setFeedback(null);
    try {
      await undoSwipe(recentSwipe.swipeId);
      setFeedback(`Restored ${recentSwipe.targetName.split(' ')[0]} to your deck.`);
      setRecentSwipe(null);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Undo window expired or already matched.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleActivityUndo = async (swipe: SwipeRecord, targetName: string) => {
    if (undoingSwipeId) return;
    setUndoingSwipeId(swipe.id);
    setFeedback(null);
    try {
      await undoSwipe(swipe.id);
      setFeedback(`Restored ${targetName.split(' ')[0]} to your Discover deck.`);
      if (recentSwipe?.swipeId === swipe.id) {
        setRecentSwipe(null);
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Undo window expired or already matched.');
    } finally {
      setUndoingSwipeId(null);
    }
  };

  const handleQuickRadius = async (nextKm: number) => {
    const clamped = Math.max(
      VOLUMETRIC_LIMITS.MIN_DISTANCE_KM,
      Math.min(VOLUMETRIC_LIMITS.MAX_DISTANCE_KM, Math.round(nextKm))
    );
    if (clamped === privateAccount.maxDistanceKm || radiusBusy) return;
    setRadiusBusy(true);
    setFeedback(null);
    try {
      await updateDiscoveryPreferences(viewer.uid, {
        minAge: privateAccount.minAge,
        maxAge: privateAccount.maxAge,
        maxDistanceKm: clamped,
        showMe: viewer.isVisible,
        interestedIn: viewer.interestedIn,
      });
      setFeedback(`Discovery radius updated to ${clamped} km.`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to update discovery radius.');
    } finally {
      setRadiusBusy(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (reportTarget || blockTarget || inspectProfile || showActivityModal || !activeCandidate || busyAction) {
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') void handleSwipe('pass');
      else if (e.key === 'ArrowRight') void handleSwipe('like');
      else if (e.key === 'ArrowUp') void handleSwipe('superlike');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleBlockConfirm = async () => {
    if (!blockTarget) return;
    setSafetyBusy(true);
    const target = blockTarget;
    const existingConv = conversationByPartner.get(target.uid);
    try {
      await blockUser({
        blockerId: viewer.uid,
        blockedId: target.uid,
        blockedName: target.displayName,
        activeLiveMatchId: existingConv?.kind === 'live' ? existingConv.id : undefined,
        activeDemoMatchId: existingConv?.kind === 'demo' ? existingConv.id : undefined,
      });
      setFeedback(
        `${target.displayName.split(' ')[0]} has been blocked and removed from active conversations.`
      );
      setBlockTarget(null);
    } catch (err) {
      setBlockTarget(null);
      setFeedback(
        formatFriendlyActionError(err, 'Unable to block this user right now. Please try again.')
      );
    } finally {
      setSafetyBusy(false);
    }
  };

  const handleReportSubmit = async (payload: {
    reason: ReportReason;
    details: string;
    alsoBlock: boolean;
  }) => {
    if (!reportTarget) return;
    setSafetyBusy(true);
    const target = reportTarget;
    const existingConv = conversationByPartner.get(target.uid);
    try {
      await submitReport({
        reporterId: viewer.uid,
        reportedId: target.uid,
        conversationId: existingConv?.id ?? 'discovery_card',
        reason: payload.reason,
        details: payload.details,
      });
      if (payload.alsoBlock) {
        await blockUser({
          blockerId: viewer.uid,
          blockedId: target.uid,
          blockedName: target.displayName,
          activeLiveMatchId: existingConv?.kind === 'live' ? existingConv.id : undefined,
          activeDemoMatchId: existingConv?.kind === 'demo' ? existingConv.id : undefined,
        });
      }
      setFeedback(
        payload.alsoBlock
          ? `Safety report submitted and ${target.displayName.split(' ')[0]} has been blocked.`
          : `Safety report submitted for ${target.displayName.split(' ')[0]}.`
      );
      setReportTarget(null);
    } catch (err) {
      setReportTarget(null);
      setFeedback(
        formatFriendlyActionError(err, 'Unable to submit safety report right now. Please try again.')
      );
    } finally {
      setSafetyBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Calm Queue Nudge: Focus on active conversations when 4+ matches await reply */}
      {replyNeededCount >= 4 ? (
        <div className="bg-[#DCF0EA]/80 border border-[#A9D7C8] rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-[#2E6B5C]">
            <MessageCircle className="w-4 h-4 shrink-0" />
            <p className="font-semibold">
              Calm Queue Nudge: <span className="font-bold">{replyNeededCount} matches</span> are waiting for your reply. Focus on real conversations before adding more threads.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenReplies}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#2E6B5C] hover:bg-[#235447] text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            Open Replies ({replyNeededCount})
          </button>
        </div>
      ) : null}

      {/* Top Interactive Deck Toolbar & Quick Filter Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0"
          role="tablist"
          aria-label="Filter discovery deck"
        >
          {(
            [
              { id: 'all', label: 'All Nearby', count: filterCounts.all },
              { id: 'high_match', label: '80%+ Match', count: filterCounts.high_match },
              { id: 'shared_interests', label: 'Shared Interests', count: filterCounts.shared_interests },
              { id: 'nearby_10km', label: 'Within 10 km', count: filterCounts.nearby_10km },
            ] as const
          ).map((tab) => {
            const active = deckFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setDeckFilter(tab.id)}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-bold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#E8603A] text-white border-[#E8603A] shadow-xs'
                    : 'bg-white text-[#7A5234] border-[#F5C4A8] hover:border-[#E8603A] hover:text-[#3D2817]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    active ? 'text-white/90' : 'text-[#9E7756]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowActivityModal(true)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-[#F5C4A8] hover:border-[#3D8C7A] hover:bg-[#DCF0EA]/35 text-xs font-bold text-[#3D2817] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-[#3D8C7A]" />
            <span>Activity</span>
            <span className="font-mono tabular-nums text-[#2E6B5C]">({swipes.length})</span>
          </button>

          <button
            type="button"
            onClick={onOpenPreferences}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-[#F5C4A8] hover:border-[#E8603A] hover:bg-[#FFF8EC] text-xs font-bold text-[#7A5234] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#E8603A]" />
            <span>Preferences</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left/Main Column: Discovery Card Stack */}
        <div className="lg:col-span-7 flex flex-col items-center">
          {feedback ? (
            <div className="w-full max-w-md mb-4 px-4 py-2.5 rounded-2xl bg-white border border-[#F5C4A8] text-xs font-bold text-[#7A5234] flex items-center justify-between">
              <span>{feedback}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-[#C44C29] hover:underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          ) : null}

          {activeCandidate ? (
            <div className="w-full max-w-md space-y-4">
              <AnimatePresence mode="wait">
                <motion.article
                  key={activeCandidate.profile.uid}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white border border-[#F5C4A8] rounded-[28px] overflow-hidden shadow-[0_8px_24px_rgba(61,40,23,0.10)]"
                >
                  {/* Portrait Stage */}
                  <div className="relative aspect-[4/5] bg-gradient-to-br from-[#FDE4D8] to-[#F5C4A8]">
                    <AvatarImage
                      src={
                        activeCandidate.profile.photos[
                          photoIdx % Math.max(1, activeCandidate.profile.photos.length)
                        ]
                      }
                      name={activeCandidate.profile.displayName}
                      className="w-full h-full"
                    />

                    {activeCandidate.profile.photos.length > 1 ? (
                      <div className="absolute inset-x-3 top-3 flex gap-1.5">
                        {activeCandidate.profile.photos.map((_, idx) => (
                          <div
                            key={idx}
                            className={`h-1 flex-1 rounded-full ${
                              idx === photoIdx ? 'bg-white' : 'bg-white/40'
                            }`}
                          />
                        ))}
                      </div>
                    ) : null}

                    {activeCandidate.profile.photos.length > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setPhotoIdx((i) =>
                              (i - 1 + activeCandidate.profile.photos.length) %
                              activeCandidate.profile.photos.length
                            )
                          }
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/35 hover:bg-black/55 text-white flex items-center justify-center cursor-pointer"
                          aria-label="Previous photo"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPhotoIdx((i) => (i + 1) % activeCandidate.profile.photos.length)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/35 hover:bg-black/55 text-white flex items-center justify-center cursor-pointer"
                          aria-label="Next photo"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    ) : null}

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2B1A10]/90 via-[#2B1A10]/45 to-transparent p-6 text-white">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-xs text-[#A9D7C8] font-semibold">
                          {activeCandidate.breakdown.total}% Compatible ·{' '}
                          {displayDistance(activeCandidate.breakdown.distanceKm)}
                          {activeCandidate.profile.isDemo ? ' · Sample' : ''}
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            type="button"
                            onClick={() => setInspectProfile(activeCandidate.profile)}
                            className="text-xs font-bold text-white/95 hover:text-[#FFC98B] inline-flex items-center gap-1 underline cursor-pointer whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Full profile</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowBreakdown((s) => !s)}
                            className="text-xs font-bold text-white/95 hover:text-[#FFC98B] inline-flex items-center gap-1 underline cursor-pointer whitespace-nowrap"
                          >
                            <Info className="w-3.5 h-3.5" />
                            <span>{showBreakdown ? 'Hide math' : 'Why we matched'}</span>
                          </button>
                        </div>
                      </div>
                      <h2 className="text-3xl font-bold leading-tight">
                        {activeCandidate.profile.displayName}, {activeCandidate.profile.age}
                      </h2>
                      <p className="text-sm text-white/90 mt-0.5 flex items-center gap-1.5 font-medium">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-[#FFC98B]" />
                        <span>
                          {activeCandidate.profile.jobTitle} · {activeCandidate.profile.city}
                        </span>
                      </p>
                      {activeCandidate.profile.connectionGoal ||
                      (activeCandidate.profile.isProfileVerified && activeCandidate.profile.isSelfieVerified) ? (
                        <p className="text-xs text-[#DCF0EA] mt-1.5 flex flex-wrap items-center gap-2 font-medium">
                          {activeCandidate.profile.isProfileVerified &&
                          activeCandidate.profile.isSelfieVerified ? (
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#A9D7C8]" />
                              <span>Real ID &amp; Selfie Verified</span>
                            </span>
                          ) : null}
                          {activeCandidate.profile.connectionGoal ? (
                            <span>· {activeCandidate.profile.connectionGoal}</span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 sm:p-6 space-y-4">
                    <p className="text-sm text-[#3D2817] leading-relaxed">
                      {activeCandidate.profile.bio}
                    </p>

                    {activeCandidate.profile.storySparks &&
                    activeCandidate.profile.storySparks.length > 0 ? (
                      <div className="pt-2 border-t border-[#FDE4D8] space-y-2.5">
                        <p className="text-xs font-mono uppercase tracking-wider text-[#E8603A] font-semibold">
                          Story Sparks
                        </p>
                        {activeCandidate.profile.storySparks.slice(0, 2).map((spark, idx) => (
                          <div
                            key={`${spark.question}_${idx}`}
                            className="rounded-2xl bg-[#FFF8EC] border border-[#F5C4A8] p-3.5 space-y-1"
                          >
                            <p className="text-[11px] font-mono font-semibold text-[#7A5234]">
                              {spark.question}
                            </p>
                            <p className="text-sm font-semibold text-[#3D2817] leading-snug">
                              {spark.answer}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {activeCandidate.profile.interests.length > 0 ? (
                      <div className="pt-2 border-t border-[#FDE4D8]">
                        <p className="text-xs font-mono uppercase tracking-wider text-[#9E7756] mb-1">
                          Interests
                        </p>
                        <p className="text-sm font-semibold text-[#3D2817]">
                          {activeCandidate.profile.interests.join(' · ')}
                        </p>
                      </div>
                    ) : null}

                    {showBreakdown ? (
                      <div className="p-3.5 rounded-2xl bg-[#FFF8EC] border border-[#F5C4A8] space-y-2">
                        <p className="text-xs font-mono uppercase tracking-wider text-[#2E6B5C] font-semibold">
                          Compatibility Math ({activeCandidate.breakdown.total}/100)
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-medium text-[#7A5234]">
                          <span>Proximity (34%): {Math.round(activeCandidate.breakdown.distanceScore * 100)}%</span>
                          <span>Interests (24%): {Math.round(activeCandidate.breakdown.interestOverlapScore * 100)}%</span>
                          <span>Age Fit (16%): {Math.round(activeCandidate.breakdown.ageFitScore * 100)}%</span>
                          <span>Activity (14%): {Math.round(activeCandidate.breakdown.activityScore * 100)}%</span>
                        </div>
                      </div>
                    ) : null}

                    <div className="pt-2 border-t border-[#FDE4D8] flex items-center justify-between text-xs text-[#7A5234]">
                      <span>{activeCandidate.breakdown.reasons.slice(0, 2).join(' · ')}</span>
                      <div className="flex items-center gap-3 shrink-0 font-bold">
                        <button
                          type="button"
                          onClick={() => setReportTarget(activeCandidate.profile)}
                          className="hover:text-[#E8603A] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Flag className="w-3.5 h-3.5" />
                          <span>Report</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBlockTarget(activeCandidate.profile)}
                          className="hover:text-[#C44C29] inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Block User</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.article>
              </AnimatePresence>

              {/* Spark Note Composer (Attach a tailored opener with Like / Super Like) */}
              {showNoteComposer ? (
                <div className="bg-white border border-[#F5C4A8] rounded-2xl p-3.5 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="spark-note-input"
                      className="text-xs font-bold text-[#3D2817] flex items-center gap-1.5"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5 text-[#E8603A]" />
                      <span>
                        Attach a Spark Note for {activeCandidate.profile.displayName.split(' ')[0]}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNoteComposer(false);
                        setSparkNote('');
                      }}
                      className="text-xs font-bold text-[#7A5234] hover:text-[#C44C29] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="spark-note-input"
                      type="text"
                      maxLength={VOLUMETRIC_LIMITS.MAX_SWIPE_NOTE_LEN}
                      value={sparkNote}
                      onChange={(e) => setSparkNote(e.target.value)}
                      placeholder="Reply to their Story Spark or shared interest..."
                      className="flex-1 min-w-0 min-h-[40px] px-3 py-2 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] text-xs font-medium text-[#3D2817] focus:outline-none focus:border-[#E8603A] focus:bg-white"
                    />
                    <button
                      type="button"
                      disabled={!sparkNote.trim() || Boolean(busyAction)}
                      onClick={() => void handleSwipe('like')}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] disabled:opacity-50 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                    >
                      Send + Like
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowNoteComposer(true)}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white border border-[#F5C4A8] hover:border-[#E8603A] text-xs font-bold text-[#7A5234] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5 text-[#E8603A]" />
                    <span>Add Spark Note to Like</span>
                  </button>
                </div>
              )}

              {/* Thumb-Zone Action Controls */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo || Boolean(busyAction)}
                  title={canUndo ? 'Undo previous swipe' : 'Undo available for 3 min before match'}
                  className="w-12 h-12 rounded-full border border-[#F5C4A8] bg-white hover:bg-[#FFF8EC] disabled:opacity-35 text-[#7A5234] flex items-center justify-center shadow-sm transition-transform active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Undo swipe"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => void handleSwipe('pass')}
                  disabled={Boolean(busyAction)}
                  className="w-16 h-16 rounded-full border border-[#F5C4A8] bg-white hover:border-[#E8603A] hover:bg-[#FFF8EC] text-[#7A5234] flex items-center justify-center shadow-sm transition-transform active:scale-95 cursor-pointer"
                  aria-label="Pass"
                >
                  <X className="w-7 h-7" />
                </button>

                <button
                  type="button"
                  onClick={() => void handleSwipe('superlike')}
                  disabled={Boolean(busyAction)}
                  className="w-14 h-14 rounded-full border border-[#A9D7C8] bg-[#DCF0EA] hover:bg-[#CBE8DF] text-[#2E6B5C] flex items-center justify-center shadow-sm transition-transform active:scale-95 cursor-pointer"
                  aria-label="Super Like"
                >
                  <Star className="w-6 h-6 fill-current" />
                </button>

                <button
                  type="button"
                  onClick={() => void handleSwipe('like')}
                  disabled={Boolean(busyAction)}
                  className="w-16 h-16 rounded-full bg-[#E8603A] hover:bg-[#C44C29] text-white flex items-center justify-center shadow-[0_6px_18px_rgba(232,96,58,0.35)] transition-transform active:scale-95 cursor-pointer"
                  aria-label="Like"
                >
                  <Heart className="w-7 h-7 fill-current" />
                </button>
              </div>
            </div>
          ) : rankedCandidates.length > 0 ? (
            <div className="w-full max-w-md bg-white border border-[#F5C4A8] rounded-[28px] p-8 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-[#FDE4D8] text-[#C44C29] flex items-center justify-center mx-auto">
                <Compass className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-[#3D2817]">
                No matches under this filter
              </h2>
              <p className="text-sm text-[#7A5234] leading-relaxed">
                You still have {rankedCandidates.length} eligible profile
                {rankedCandidates.length === 1 ? '' : 's'} nearby. Reset the quick filter to see everyone in your deck.
              </p>
              <button
                type="button"
                onClick={() => setDeckFilter('all')}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Show All Nearby ({rankedCandidates.length})</span>
              </button>
            </div>
          ) : (
            <div className="w-full max-w-md bg-white border border-[#F5C4A8] rounded-[28px] p-8 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-[#DCF0EA] text-[#2E6B5C] flex items-center justify-center mx-auto">
                <Compass className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-[#3D2817]">
                You&apos;ve seen everyone nearby
              </h2>
              <p className="text-sm text-[#7A5234] leading-relaxed">
                No more active profiles match your current {privateAccount.minAge}–{privateAccount.maxAge} age window within {privateAccount.maxDistanceKm} km. Try widening your discovery radius or check back soon.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                {canUndo ? (
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-[#F5C4A8] text-sm font-bold text-[#3D2817] hover:bg-[#FFF8EC] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Undo Last</span>
                  </button>
                ) : null}
                {privateAccount.maxDistanceKm < 200 ? (
                  <button
                    type="button"
                    disabled={radiusBusy}
                    onClick={() => void handleQuickRadius(privateAccount.maxDistanceKm + 25)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#3D8C7A] hover:bg-[#2E6B5C] text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <span>{radiusBusy ? 'Widening...' : 'Widen +25 km'}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onOpenPreferences}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Adjust Filters</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Desktop Companion Panel: Today's Mutual Pick, Daily Pulse, Curated Highlights & Discovery Engine */}
        <aside className="lg:col-span-5 space-y-5">
          {dailyMutualPick ? (
            <div className="bg-white border border-[#F5C4A8] rounded-3xl p-5 space-y-3.5 shadow-[0_2px_8px_rgba(61,40,23,0.06)]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-[#E8603A] font-semibold">
                    Today&apos;s Mutual Pick
                  </p>
                  <h3 className="text-lg font-bold text-[#3D2817]">
                    Balanced Bidirectional Match
                  </h3>
                </div>
                <span className="font-mono text-xs font-bold text-[#2E6B5C]">
                  {dailyMutualPick.breakdown.total}% Fit
                </span>
              </div>

              <div className="flex items-center gap-3.5">
                <AvatarImage
                  src={dailyMutualPick.profile.photos[0]}
                  name={dailyMutualPick.profile.displayName}
                  className="w-16 h-16 rounded-2xl shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-base font-bold text-[#3D2817] truncate">
                    {dailyMutualPick.profile.displayName}, {dailyMutualPick.profile.age}
                  </p>
                  <p className="text-xs text-[#7A5234] truncate">
                    {dailyMutualPick.profile.jobTitle} · {displayDistance(dailyMutualPick.breakdown.distanceKm)}
                  </p>
                  {dailyMutualPick.breakdown.sharedInterests.length > 0 ? (
                    <p className="text-[11px] font-semibold text-[#2E6B5C] truncate">
                      Shared: {dailyMutualPick.breakdown.sharedInterests.slice(0, 2).join(', ')}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setInspectProfile(dailyMutualPick.profile)}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] hover:bg-[#FDE4D8]/60 text-xs font-bold text-[#3D2817] whitespace-nowrap cursor-pointer"
                >
                  Inspect
                </button>
                <button
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={() => void handleSwipe('like', dailyMutualPick)}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-xs font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-55"
                >
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  <span>Like</span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={() => void handleSwipe('superlike', dailyMutualPick)}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#DCF0EA] hover:bg-[#CBE8DF] border border-[#A9D7C8] text-[#2E6B5C] text-xs font-bold inline-flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-55"
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>Super Like</span>
                </button>
              </div>
            </div>
          ) : null}

          <DailyNearMatchPulse />

          <div className="bg-white border border-[#F5C4A8] rounded-3xl p-6 space-y-4 shadow-[0_2px_8px_rgba(61,40,23,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-[#2E6B5C] font-semibold">
                  Discovery Engine
                </p>
                <h3 className="text-xl font-bold text-[#3D2817] mt-0.5">
                  {filteredCandidates.length} eligible nearby
                </h3>
              </div>
              <button
                type="button"
                onClick={onOpenPreferences}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#F5C4A8] hover:bg-[#FFF8EC] text-xs font-bold text-[#7A5234] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Edit filters
              </button>
            </div>

            <p className="text-xs text-[#7A5234] leading-relaxed">
              Filtering for ages <span className="font-mono font-semibold">{privateAccount.minAge}–{privateAccount.maxAge}</span>
              {privateAccount.strictAgeBoundary ? ' (strict)' : ''} within{' '}
              <span className="font-mono font-semibold">{privateAccount.maxDistanceKm} km</span> of {viewer.city}. Calibrated by distance, interests, age fit, and taste signals.
            </p>

            {/* Quick Radius Selector */}
            <div className="pt-2 border-t border-[#FDE4D8] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#3D2817]">Quick radius</span>
                <span className="font-mono text-[#2E6B5C] font-semibold">
                  {privateAccount.maxDistanceKm} km active
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {QUICK_RADIUS_OPTIONS.map((km) => {
                  const active = privateAccount.maxDistanceKm === km;
                  return (
                    <button
                      key={km}
                      type="button"
                      disabled={radiusBusy}
                      onClick={() => void handleQuickRadius(km)}
                      className={`min-h-[38px] px-2 py-1.5 rounded-xl border text-xs font-mono font-bold transition-colors cursor-pointer disabled:opacity-60 ${
                        active
                          ? 'bg-[#3D8C7A] text-white border-[#3D8C7A]'
                          : 'bg-[#FFF8EC] text-[#3D2817] border-[#F5C4A8] hover:border-[#3D8C7A]'
                      }`}
                    >
                      {km} km
                    </button>
                  );
                })}
              </div>
            </div>

            {activeCandidate ? (
              <div className="pt-3 border-t border-[#FDE4D8] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#3D2817] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#E8603A]" />
                    Score Breakdown for {activeCandidate.profile.displayName.split(' ')[0]}
                  </span>
                  <span className="font-mono text-sm font-bold text-[#2E6B5C]">
                    {activeCandidate.breakdown.total}/100
                  </span>
                </div>

                {[
                  { label: 'Proximity (34%)', val: activeCandidate.breakdown.distanceScore },
                  { label: 'Shared Interests (24%)', val: activeCandidate.breakdown.interestOverlapScore },
                  { label: 'Age Range Fit (16%)', val: activeCandidate.breakdown.ageFitScore },
                  { label: 'Recent Activity (14%)', val: activeCandidate.breakdown.activityScore },
                  { label: 'Profile Depth (12%)', val: activeCandidate.breakdown.completenessScore },
                ].map((row) => (
                  <div key={row.label} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-[#7A5234]">
                      <span>{row.label}</span>
                      <span className="font-mono">{Math.round(row.val * 100)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#FFF8EC] overflow-hidden border border-[#FDE4D8]">
                      <div
                        className="h-full bg-[#3D8C7A] rounded-full transition-all"
                        style={{ width: `${Math.round(row.val * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {curatedHighlights.length > 0 ? (
            <div className="bg-white border border-[#F5C4A8] rounded-3xl p-6 space-y-3 shadow-[0_2px_8px_rgba(61,40,23,0.06)]">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-[#2E6B5C] font-semibold">
                  Curated Highlights
                </h4>
                <span className="text-[11px] text-[#7A5234]">Top interest &amp; spark fits</span>
              </div>
              <div className="divide-y divide-[#FDE4D8]">
                {curatedHighlights.map((item) => (
                  <div
                    key={item.profile.uid}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => setInspectProfile(item.profile)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-85 cursor-pointer"
                    >
                      <AvatarImage
                        src={item.profile.photos[0]}
                        name={item.profile.displayName}
                        className="w-11 h-11 rounded-xl shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#3D2817] truncate flex items-center gap-1">
                          <span>
                            {item.profile.displayName}, {item.profile.age}
                          </span>
                          {item.profile.isProfileVerified && item.profile.isSelfieVerified ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-[#2E6B5C] shrink-0" />
                          ) : null}
                        </p>
                        <p className="text-xs text-[#7A5234] truncate">
                          {item.breakdown.total}% fit · {displayDistance(item.breakdown.distanceKm)}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => void handleSwipe('superlike', item)}
                      className="min-h-[36px] px-2.5 py-1 rounded-xl bg-[#DCF0EA] hover:bg-[#CBE8DF] border border-[#A9D7C8] text-[11px] font-bold text-[#2E6B5C] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-55"
                    >
                      <Star className="w-3 h-3 fill-current" />
                      <span>Super Like</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="text-xs text-[#9E7756] px-1">
            Keyboard tips: Left arrow to Pass · Up arrow to Super Like · Right arrow to Like.
          </p>
        </aside>
      </div>

      {/* Swipe Activity Modal */}
      {showActivityModal ? (
        <div
          className="fixed inset-0 z-50 bg-[#2B1A10]/65 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowActivityModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="swipe-activity-title"
        >
          <div
            className="bg-white border border-[#F5C4A8] rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#FDE4D8] flex items-center justify-between gap-3">
              <div>
                <h3 id="swipe-activity-title" className="text-xl font-bold text-[#3D2817]">
                  Your Discovery Activity
                </h3>
                <p className="text-xs text-[#7A5234]">
                  Undo recent passes or likes within 3 minutes before a mutual match forms.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowActivityModal(false)}
                className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-[#FFF8EC] flex items-center justify-center text-[#7A5234] cursor-pointer"
                aria-label="Close activity modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto divide-y divide-[#FDE4D8]">
              {sortedSwipes.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#7A5234]">
                  No swipes recorded yet. Start exploring people nearby in your deck!
                </p>
              ) : (
                sortedSwipes.map((swipe) => {
                  const targetProfile = allCandidateProfiles.get(swipe.targetId);
                  const conv = conversationByPartner.get(swipe.targetId);
                  const targetName = targetProfile?.displayName ?? conv?.partnerName ?? 'Member';
                  const targetPhoto = targetProfile?.photos[0] ?? conv?.partnerPhoto ?? '';
                  const withinWindow =
                    !conv &&
                    Date.now() - swipe.createdAt.getTime() <= VOLUMETRIC_LIMITS.UNDO_WINDOW_MS;

                  return (
                    <div
                      key={swipe.id}
                      className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <AvatarImage
                          src={targetPhoto}
                          name={targetName}
                          className="w-11 h-11 rounded-xl shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#3D2817] truncate">
                            {targetName}
                          </p>
                          <p className="text-xs text-[#7A5234] truncate">
                            {swipe.action === 'superlike'
                              ? 'Super Liked'
                              : swipe.action === 'like'
                              ? 'Liked'
                              : 'Passed'}{' '}
                            · {formatRelativeTime(swipe.createdAt)}
                            {conv ? ' · Matched' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {conv ? (
                          <button
                            type="button"
                            onClick={() => {
                              setShowActivityModal(false);
                              onOpenChat(conv.id);
                            }}
                            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#3D8C7A] hover:bg-[#2E6B5C] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </button>
                        ) : withinWindow ? (
                          <button
                            type="button"
                            disabled={undoingSwipeId === swipe.id}
                            onClick={() => void handleActivityUndo(swipe, targetName)}
                            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#F5C4A8] bg-[#FFF8EC] hover:bg-[#FDE4D8] text-xs font-bold text-[#C44C29] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{undoingSwipeId === swipe.id ? 'Restoring...' : 'Undo'}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-mono text-[#9E7756]">Locked</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      {inspectProfile ? (
        <ProfileDetailModal
          profile={inspectProfile}
          viewerLat={viewer.approxLat}
          viewerLng={viewer.approxLng}
          onClose={() => setInspectProfile(null)}
          onReport={() => {
            const target = inspectProfile;
            setInspectProfile(null);
            setReportTarget(target);
          }}
          onBlock={() => {
            const target = inspectProfile;
            setInspectProfile(null);
            setBlockTarget(target);
          }}
        />
      ) : null}

      {reportTarget ? (
        <ReportModal
          targetName={reportTarget.displayName}
          busy={safetyBusy}
          onSubmit={handleReportSubmit}
          onClose={() => setReportTarget(null)}
        />
      ) : null}

      {blockTarget ? (
        <ConfirmActionModal
          title={`Block ${blockTarget.displayName.split(' ')[0]}?`}
          description="Blocking updates your blocked list, removes them from active conversations and discovery, and prevents future messaging. You can manage blocked accounts from Profile."
          confirmLabel="Block User"
          destructive
          busy={safetyBusy}
          onConfirm={handleBlockConfirm}
          onCancel={() => setBlockTarget(null)}
        />
      ) : null}
    </div>
  );
}

