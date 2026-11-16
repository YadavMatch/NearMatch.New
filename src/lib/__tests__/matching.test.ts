import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ageFromDob,
  computeTasteWeights,
  displayDistance,
  haversineKm,
  isEligible,
  jitterForPrivacy,
  profileCompleteness,
  rankCandidates,
  rejectionReason,
  scoreCandidate,
  selectCuratedHighlights,
  selectDailyMutualPick,
} from '../matching.ts';
import type { PrivateAccount, PublicProfile, SwipeRecord } from '../../types/models.ts';

function makeProfile(overrides: Partial<PublicProfile> = {}): PublicProfile {
  const now = new Date();
  return {
    uid: 'user_a',
    displayName: 'Aarav',
    age: 27,
    gender: 'man',
    interestedIn: ['woman'],
    bio: 'Always exploring local roasteries and weekend coastal walks.',
    jobTitle: 'Designer',
    city: 'Mumbai',
    interests: ['Specialty Coffee', 'Indie Cinema', 'Coastal Walks'],
    photos: ['/img.jpg'],
    approxLat: 19.0596,
    approxLng: 72.8295,
    isOnboarded: true,
    isVisible: true,
    isBanned: false,
    isDeleted: false,
    lastActiveAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const defaultPrefs: Pick<PrivateAccount, 'minAge' | 'maxAge' | 'maxDistanceKm' | 'strictAgeBoundary'> = {
  minAge: 23,
  maxAge: 32,
  maxDistanceKm: 30,
};

test('ageFromDob enforces UTC calendar boundaries accurately', () => {
  const ref = new Date(Date.UTC(2026, 4, 10)); // May 10, 2026
  assert.equal(ageFromDob('2008-05-10', ref), 18);
  assert.equal(ageFromDob('2008-05-11', ref), 17);
  assert.equal(ageFromDob('1998-02-30', ref), null);
});

test('jitterForPrivacy is deterministic & idempotent on repeated saves', () => {
  const first = jitterForPrivacy(19.0596, 72.8295, 'uid_123');
  const second = jitterForPrivacy(19.0596, 72.8295, 'uid_123');
  assert.deepEqual(first, second);
  const driftKm = haversineKm(19.0596, 72.8295, first.approxLat, first.approxLng);
  assert.ok(driftKm < 0.5, `Expected < 0.5km privacy snap, got ${driftKm}`);
});

test('hard eligibility gates enforce 18+ floor, blocks, mutual orientation, radius, and strict age boundary', () => {
  const viewer = makeProfile({ uid: 'viewer', gender: 'man', interestedIn: ['woman'] });
  const ctx = { swipedIds: new Set<string>(['swiped_u']), blockedIds: new Set<string>(['blocked_u']) };

  assert.equal(
    rejectionReason(viewer, defaultPrefs, makeProfile({ uid: 'viewer' }), ctx),
    'self'
  );
  assert.equal(
    rejectionReason(viewer, defaultPrefs, makeProfile({ uid: 'u1', age: 17, gender: 'woman', interestedIn: ['man'] }), ctx),
    'underage'
  );
  assert.equal(
    rejectionReason(viewer, defaultPrefs, makeProfile({ uid: 'blocked_u', gender: 'woman', interestedIn: ['man'] }), ctx),
    'blocked'
  );
  assert.equal(
    rejectionReason(viewer, defaultPrefs, makeProfile({ uid: 'swiped_u', gender: 'woman', interestedIn: ['man'] }), ctx),
    'already_swiped'
  );
  assert.equal(
    rejectionReason(viewer, defaultPrefs, makeProfile({ uid: 'u2', gender: 'woman', interestedIn: ['woman'] }), ctx),
    'candidate_orientation'
  );
  assert.equal(
    rejectionReason(
      viewer,
      defaultPrefs,
      makeProfile({ uid: 'far_u', gender: 'woman', interestedIn: ['man'], approxLat: 28.6139, approxLng: 77.209 }),
      ctx
    ),
    'distance'
  );

  // Soft grace accepts age 33 when maxAge is 32, whereas strictAgeBoundary rejects it
  const graceCandidate = makeProfile({ uid: 'grace_u', gender: 'woman', interestedIn: ['man'], age: 33 });
  assert.equal(isEligible(viewer, defaultPrefs, graceCandidate, ctx), true);
  assert.equal(
    rejectionReason(viewer, { ...defaultPrefs, strictAgeBoundary: true }, graceCandidate, ctx),
    'age_range'
  );

  const good = makeProfile({ uid: 'good_u', gender: 'woman', interestedIn: ['man'], age: 26 });
  assert.equal(isEligible(viewer, defaultPrefs, good, ctx), true);
});

test('scoring, taste calibration, daily mutual pick, and curated highlights rank aligned profiles highest', () => {
  const viewer = makeProfile({
    uid: 'viewer',
    gender: 'man',
    interestedIn: ['woman'],
    connectionGoal: 'Long-term partner',
  });
  const highFit = makeProfile({
    uid: 'high_fit',
    gender: 'woman',
    interestedIn: ['man'],
    interests: ['Specialty Coffee', 'Indie Cinema', 'Coastal Walks'],
    connectionGoal: 'Long-term partner',
    storySparks: [{ question: 'Ideal Sunday', answer: 'Coffee & coastal stroll.' }],
    isProfileVerified: true,
    isSelfieVerified: true,
  });
  const lowFit = makeProfile({
    uid: 'low_fit',
    gender: 'woman',
    interestedIn: ['man'],
    interests: ['Cycling'],
    bio: 'Short',
    jobTitle: '',
    approxLat: 19.22,
    approxLng: 72.95,
  });

  const swipes: SwipeRecord[] = [
    { id: 'v_prev', actorId: 'viewer', targetId: 'prev_like', action: 'like', createdAt: new Date() },
  ];
  const prevLikeProfile = makeProfile({
    uid: 'prev_like',
    interests: ['Specialty Coffee', 'Indie Cinema'],
  });
  const weights = computeTasteWeights(
    swipes,
    new Map([['prev_like', prevLikeProfile]]),
    ['Coastal Walks']
  );
  assert.ok((weights.get('specialty coffee') ?? 0) > 0);
  assert.ok((weights.get('coastal walks') ?? 0) > 0);

  const sHigh = scoreCandidate(viewer, defaultPrefs, highFit, Date.now(), weights);
  const sLow = scoreCandidate(viewer, defaultPrefs, lowFit, Date.now(), weights);
  assert.ok(sHigh.total > sLow.total);
  assert.equal(displayDistance(0.4), '< 1 km away');
  assert.ok(profileCompleteness(highFit) >= 0.9);

  const ranked = rankCandidates(viewer, defaultPrefs, [lowFit, highFit], {
    swipedIds: new Set(),
    blockedIds: new Set(),
    tasteWeights: weights,
  });
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].profile.uid, 'high_fit');

  const mutual = selectDailyMutualPick(viewer, ranked, new Date('2026-11-15T10:00:00Z'));
  assert.equal(mutual?.profile.uid, 'high_fit');

  const highlights = selectCuratedHighlights(ranked, mutual?.profile.uid, 3);
  assert.equal(highlights.length, 1);
  assert.equal(highlights[0].profile.uid, 'low_fit');
});
