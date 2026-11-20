import { useEffect, useMemo, useRef, useState } from 'react';
import { buildBlockedUidSet, filterActiveConversations } from '../lib/blocking';
import { DEMO_PROFILES } from '../lib/demoProfiles';
import {
  DELETED_ACCOUNT_LABEL,
  isErasedSummary,
  sendDemoSafetyCheck,
  subscribeDemoMatches,
  subscribeDiscoveryProfiles,
  subscribeLiveMatches,
  subscribeMyBlocks,
  subscribeMySwipes,
} from '../lib/firestoreService';
import {
  computeTasteWeights,
  rankCandidates,
  selectCuratedHighlights,
  selectDailyMutualPick,
} from '../lib/matching';
import {
  findFirstMatch,
  getSafetyCheckAt,
  isSafetyCheckDue,
  SAFETY_CHECK_MESSAGE_ID,
  SAFETY_CHECK_SENDER_ID,
} from '../lib/safetyCheck';
import type {
  BlockRecord,
  DemoMatchRecord,
  MatchRecord,
  PrivateAccount,
  PublicProfile,
  RankedCandidate,
  SwipeRecord,
  UnifiedConversation,
} from '../types/models';

export interface NearMatchDataState {
  rankedCandidates: RankedCandidate[];
  dailyMutualPick: RankedCandidate | null;
  curatedHighlights: RankedCandidate[];
  allCandidateProfiles: Map<string, PublicProfile>;
  swipes: SwipeRecord[];
  blocks: BlockRecord[];
  liveMatches: MatchRecord[];
  demoMatches: DemoMatchRecord[];
  conversations: UnifiedConversation[];
  existingLiveMatchIds: Set<string>;
  firstMatchId: string | null;
  safetyCheckNowMs: number;
  totalUnread: number;
  replyNeededCount: number;
  dataError: string | null;
  clearDataError: () => void;
  markConversationSeenLocally: (id: string) => void;
}

export function useNearMatchData(
  profile: PublicProfile | null,
  privateAccount: PrivateAccount | null
): NearMatchDataState {
  const [liveProfiles, setLiveProfiles] = useState<PublicProfile[]>([]);
  const [swipes, setSwipes] = useState<SwipeRecord[]>([]);
  const [blocks, setBlocks] = useState<BlockRecord[]>([]);
  const [liveMatches, setLiveMatches] = useState<MatchRecord[]>([]);
  const [demoMatches, setDemoMatches] = useState<DemoMatchRecord[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);
  const [seenTimestamps, setSeenTimestamps] = useState<Record<string, number>>({});
  const [safetyCheckNowMs, setSafetyCheckNowMs] = useState<number>(() => Date.now());
  const sentDemoSafetyCheckRef = useRef<Set<string>>(new Set());

  const isActiveMember =
    Boolean(profile) &&
    Boolean(privateAccount) &&
    Boolean(profile?.isOnboarded) &&
    !profile?.isDeleted &&
    !profile?.isBanned;

  useEffect(() => {
    if (!isActiveMember || !profile) {
      setLiveProfiles([]);
      setSwipes([]);
      setBlocks([]);
      setLiveMatches([]);
      setDemoMatches([]);
      return;
    }

    const onErr = (err: Error) => setDataError(err.message);

    const unsubProfiles = subscribeDiscoveryProfiles(setLiveProfiles, onErr);
    const unsubSwipes = subscribeMySwipes(profile.uid, setSwipes, onErr);
    const unsubBlocks = subscribeMyBlocks(profile.uid, setBlocks, onErr);
    const unsubLive = subscribeLiveMatches(profile.uid, setLiveMatches, onErr);
    const unsubDemo = subscribeDemoMatches(profile.uid, setDemoMatches, onErr);

    return () => {
      unsubProfiles();
      unsubSwipes();
      unsubBlocks();
      unsubLive();
      unsubDemo();
    };
  }, [isActiveMember, profile?.uid]);

  const allCandidateProfiles = useMemo(() => {
    const map = new Map<string, PublicProfile>();
    for (const demo of DEMO_PROFILES) {
      map.set(demo.uid, demo);
    }
    for (const live of liveProfiles) {
      map.set(live.uid, live);
    }
    return map;
  }, [liveProfiles]);

  const rankedCandidates = useMemo(() => {
    if (!profile || !privateAccount || !isActiveMember) return [];
    const swipedIds = new Set(swipes.map((s) => s.targetId));
    const blockedIds = buildBlockedUidSet(blocks);
    const pool = Array.from(allCandidateProfiles.values());
    const tasteWeights = computeTasteWeights(
      swipes,
      allCandidateProfiles,
      privateAccount.preferredInterests ?? []
    );

    return rankCandidates(profile, privateAccount, pool, {
      swipedIds,
      blockedIds,
      tasteWeights,
    });
  }, [profile, privateAccount, isActiveMember, swipes, blocks, allCandidateProfiles]);

  const dailyMutualPick = useMemo(
    () => (profile ? selectDailyMutualPick(profile, rankedCandidates) : null),
    [profile, rankedCandidates]
  );

  const curatedHighlights = useMemo(
    () => selectCuratedHighlights(rankedCandidates, dailyMutualPick?.profile.uid ?? null, 3),
    [rankedCandidates, dailyMutualPick?.profile.uid]
  );

  const existingLiveMatchIds = useMemo(
    () => new Set(liveMatches.map((m) => m.id)),
    [liveMatches]
  );

  const firstMatch = useMemo(() => {
    const allTimings = [
      ...liveMatches.map((m) => ({ id: m.id, matchedAt: m.matchedAt, kind: 'live' as const })),
      ...demoMatches.map((d) => ({ id: d.demoId, matchedAt: d.createdAt, kind: 'demo' as const })),
    ];
    return findFirstMatch(allTimings);
  }, [liveMatches, demoMatches]);

  const firstMatchId = firstMatch?.id ?? null;

  // Schedule a timer for the 24-hour Safety Check threshold if not yet reached
  useEffect(() => {
    if (!firstMatch) return;
    const now = Date.now();
    setSafetyCheckNowMs(now);
    const dueMs = getSafetyCheckAt(firstMatch.matchedAt).getTime();
    const remainingMs = dueMs - now;
    if (remainingMs <= 0) return;

    const clampedDelay = Math.min(remainingMs + 50, 2_147_483_647);
    const timer = window.setTimeout(() => {
      setSafetyCheckNowMs(Date.now());
    }, clampedDelay);

    return () => window.clearTimeout(timer);
  }, [firstMatch?.id, firstMatch?.matchedAt.getTime()]);

  // Automatically persist the 24h Safety Check follow-up on demo first matches
  useEffect(() => {
    if (!profile || !firstMatch || firstMatch.kind !== 'demo') return;
    if (!isSafetyCheckDue(firstMatch.matchedAt, safetyCheckNowMs)) return;

    const demo = demoMatches.find((d) => d.demoId === firstMatch.id);
    if (!demo) return;
    if (demo.messages.some((m) => m.id === SAFETY_CHECK_MESSAGE_ID)) return;

    const cacheKey = `${profile.uid}_${demo.demoId}`;
    if (sentDemoSafetyCheckRef.current.has(cacheKey)) return;
    sentDemoSafetyCheckRef.current.add(cacheKey);

    void sendDemoSafetyCheck(profile.uid, demo).catch(() => {
      sentDemoSafetyCheckRef.current.delete(cacheKey);
    });
  }, [profile, firstMatch, safetyCheckNowMs, demoMatches]);

  const conversations = useMemo(() => {
    if (!profile) return [];
    const blockedSet = buildBlockedUidSet(blocks);
    const items: UnifiedConversation[] = [];

    for (const match of liveMatches) {
      const partnerUid = match.participants.find((id) => id !== profile.uid) ?? match.userHigh;
      if (blockedSet.has(partnerUid)) continue;
      const summary = match.participantSummaries[partnerUid];
      const partnerErased = isErasedSummary(summary);
      const partnerProfile = allCandidateProfiles.get(partnerUid);
      const lastAt = match.lastMessageAt ?? match.matchedAt;
      const seenAt = seenTimestamps[match.id] ?? 0;
      const safetyCheckDueForMatch =
        match.id === firstMatchId && isSafetyCheckDue(match.matchedAt, safetyCheckNowMs);
      const safetyCheckAt = getSafetyCheckAt(match.matchedAt);
      const safetyUnread = safetyCheckDueForMatch && seenAt < safetyCheckAt.getTime();
      const hasUnreadFromPartner =
        Boolean(match.lastMessageSenderId) &&
        match.lastMessageSenderId !== profile.uid &&
        lastAt.getTime() > seenAt;

      items.push({
        kind: 'live',
        id: match.id,
        partnerUid,
        partnerName: partnerErased
          ? DELETED_ACCOUNT_LABEL
          : (summary?.displayName || partnerProfile?.displayName || 'Member'),
        partnerAge: partnerErased ? 0 : (summary?.age || partnerProfile?.age || 25),
        partnerPhoto: partnerErased ? '' : (summary?.photo || partnerProfile?.photos[0] || ''),
        partnerCity: partnerErased ? '' : (summary?.city || partnerProfile?.city || 'Nearby'),
        partnerJobTitle: partnerErased ? '' : (summary?.jobTitle || partnerProfile?.jobTitle || ''),
        compatibilityScore: match.compatibilityScore,
        matchReasons: match.matchReasons,
        lastMessageText:
          safetyCheckDueForMatch && safetyCheckAt.getTime() >= lastAt.getTime()
            ? 'Safety Check · 24h check-in & safety tips'
            : match.lastMessageText ?? '',
        lastMessageAt:
          safetyCheckDueForMatch && safetyCheckAt.getTime() > lastAt.getTime()
            ? safetyCheckAt
            : lastAt,
        lastMessageSenderId: match.lastMessageSenderId,
        matchedAt: match.matchedAt,
        unreadCount: hasUnreadFromPartner || safetyUnread ? 1 : 0,
      });
    }

    for (const demo of demoMatches) {
      if (blockedSet.has(demo.demoId)) continue;
      const lastMsg = demo.messages[demo.messages.length - 1];
      const unreadCount = demo.messages.filter(
        (m) => m.senderId !== profile.uid && !m.readAtIso
      ).length;
      const previewText =
        lastMsg?.senderId === SAFETY_CHECK_SENDER_ID
          ? 'Safety Check · 24h check-in & safety tips'
          : lastMsg?.body ?? '';

      items.push({
        kind: 'demo',
        id: demo.demoId,
        partnerUid: demo.demoId,
        partnerName: demo.profileName,
        partnerAge: demo.profileAge,
        partnerPhoto: demo.profilePhoto,
        partnerCity: demo.profileCity,
        partnerJobTitle: demo.profileJobTitle,
        compatibilityScore: demo.compatibilityScore,
        matchReasons: demo.matchReasons,
        lastMessageText: previewText,
        lastMessageAt: lastMsg ? new Date(lastMsg.sentAtIso) : demo.createdAt,
        lastMessageSenderId: lastMsg?.senderId,
        matchedAt: demo.createdAt,
        unreadCount,
        demoMessages: demo.messages,
      });
    }

    return filterActiveConversations(items, blockedSet).sort(
      (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
    );
  }, [profile, liveMatches, demoMatches, blocks, allCandidateProfiles, seenTimestamps, firstMatchId, safetyCheckNowMs]);

  const totalUnread = useMemo(
    () => conversations.reduce((acc, c) => acc + c.unreadCount, 0),
    [conversations]
  );

  const replyNeededCount = useMemo(() => {
    if (!profile) return 0;
    return conversations.filter(
      (c) =>
        Boolean(c.lastMessageSenderId) &&
        c.lastMessageSenderId !== profile.uid &&
        c.lastMessageSenderId !== SAFETY_CHECK_SENDER_ID
    ).length;
  }, [conversations, profile]);

  const markConversationSeenLocally = (id: string) => {
    setSeenTimestamps((prev) => ({ ...prev, [id]: Date.now() }));
  };

  return {
    rankedCandidates,
    dailyMutualPick,
    curatedHighlights,
    allCandidateProfiles,
    swipes,
    blocks,
    liveMatches,
    demoMatches,
    conversations,
    existingLiveMatchIds,
    firstMatchId,
    safetyCheckNowMs,
    totalUnread,
    replyNeededCount,
    dataError,
    clearDataError: () => setDataError(null),
    markConversationSeenLocally,
  };
}
