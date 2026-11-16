import type { BlockRecord, PublicProfile, UnifiedConversation } from '../types/models';

export function buildBlockedUidSet(blocks: BlockRecord[]): Set<string> {
  return new Set(blocks.map((b) => b.blockedId));
}

export function filterActiveConversations<T extends Pick<UnifiedConversation, 'partnerUid'>>(
  conversations: T[],
  blockedIds: Set<string>
): T[] {
  if (blockedIds.size === 0) return conversations;
  return conversations.filter((conv) => !blockedIds.has(conv.partnerUid));
}

export function buildFallbackPartnerProfile(
  conversation: UnifiedConversation,
  fallbackLat: number,
  fallbackLng: number
): PublicProfile {
  return {
    uid: conversation.partnerUid,
    displayName: conversation.partnerName,
    age: conversation.partnerAge,
    gender: 'other',
    interestedIn: ['woman', 'man', 'non_binary', 'other'],
    bio: conversation.matchReasons[0] ?? 'Active NearMatch connection.',
    jobTitle: conversation.partnerJobTitle || 'NearMatch Member',
    city: conversation.partnerCity || 'Nearby',
    interests: [],
    photos: conversation.partnerPhoto ? [conversation.partnerPhoto] : [],
    approxLat: fallbackLat,
    approxLng: fallbackLng,
    isOnboarded: true,
    isVisible: true,
    isBanned: false,
    isDeleted: false,
    lastActiveAt: conversation.lastMessageAt,
    createdAt: conversation.matchedAt,
    updatedAt: conversation.lastMessageAt,
    isDemo: conversation.kind === 'demo',
  };
}

export function formatFriendlyActionError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const raw = error.message.trim();
  if (!raw) return fallback;
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw) as { error?: unknown };
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        if (parsed.error.toLowerCase().includes('permission')) {
          return 'You do not have permission to complete this action right now. Please refresh and try again.';
        }
        return parsed.error;
      }
    } catch {
      return fallback;
    }
  }
  return raw;
}
