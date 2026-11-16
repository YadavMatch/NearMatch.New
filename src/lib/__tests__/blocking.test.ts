import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBlockedUidSet,
  buildFallbackPartnerProfile,
  filterActiveConversations,
  formatFriendlyActionError,
} from '../blocking.ts';
import type { BlockRecord, UnifiedConversation } from '../../types/models.ts';

test('buildBlockedUidSet and filterActiveConversations remove blocked partners from active conversations', () => {
  const blocks: BlockRecord[] = [
    {
      id: 'viewer_user_2',
      blockerId: 'viewer',
      blockedId: 'user_2',
      blockedName: 'Sam',
      createdAt: new Date(),
    },
  ];
  const blockedIds = buildBlockedUidSet(blocks);
  const conversations = [
    { id: 'match_1', partnerUid: 'user_1', partnerName: 'Maya' },
    { id: 'match_2', partnerUid: 'user_2', partnerName: 'Sam' },
    { id: 'demo_aria', partnerUid: 'demo_aria', partnerName: 'Aria' },
  ];

  const active = filterActiveConversations(conversations, blockedIds);
  assert.deepEqual(
    active.map((c) => c.partnerUid),
    ['user_1', 'demo_aria']
  );
});

test('buildFallbackPartnerProfile constructs a usable profile snapshot when discovery card is hidden', () => {
  const conv: UnifiedConversation = {
    kind: 'live',
    id: 'a_b',
    partnerUid: 'b',
    partnerName: 'Riya',
    partnerAge: 27,
    partnerPhoto: 'https://example.com/riya.jpg',
    partnerCity: 'Mumbai',
    partnerJobTitle: 'Architect',
    compatibilityScore: 91,
    matchReasons: ['3 shared interests'],
    lastMessageText: 'Hello!',
    lastMessageAt: new Date('2026-01-01T10:00:00Z'),
    matchedAt: new Date('2026-01-01T09:00:00Z'),
    unreadCount: 0,
  };

  const fallback = buildFallbackPartnerProfile(conv, 19.06, 72.83);
  assert.equal(fallback.uid, 'b');
  assert.equal(fallback.displayName, 'Riya');
  assert.equal(fallback.city, 'Mumbai');
  assert.deepEqual(fallback.photos, ['https://example.com/riya.jpg']);
});

test('formatFriendlyActionError extracts readable messages from serialized Firestore errors', () => {
  const permissionErr = new Error(
    JSON.stringify({
      error: 'Missing or insufficient permissions.',
      operationType: 'write',
      path: 'blocks/u1_u2',
    })
  );
  assert.match(
    formatFriendlyActionError(permissionErr, 'Fallback'),
    /permission/i
  );

  const plainErr = new Error('Network unavailable');
  assert.equal(formatFriendlyActionError(plainErr, 'Fallback'), 'Network unavailable');
});
