import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDateSpotSuggestions, filterRankedCandidates } from '../dateIdeas.ts';
import type { RankedCandidate } from '../../types/models.ts';

test('buildDateSpotSuggestions tailors safe public meetup ideas to shared interests', () => {
  const spots = buildDateSpotSuggestions({
    viewerInterests: ['Specialty Coffee', 'Bookstores'],
    partnerInterests: ['Bookstores', 'Art Galleries'],
    partnerName: 'Meera Iyer',
    partnerCity: 'Mumbai',
    maxCount: 3,
  });

  assert.equal(spots.length, 3);
  assert.equal(spots[0].title, 'Indie bookshop & cafe stop');
  assert.match(spots[0].inviteText, /Meera/);
  assert.match(spots[0].inviteText, /Mumbai/);
  assert.ok(spots.every((s) => s.vibe.startsWith('Public')));
});

test('filterRankedCandidates filters accurately for high match, shared interests, and 10 km proximity', () => {
  const makeCandidate = (
    uid: string,
    total: number,
    distanceKm: number,
    sharedInterests: string[]
  ): RankedCandidate => ({
    profile: {
      uid,
      displayName: uid,
      age: 26,
      gender: 'woman',
      interestedIn: ['man'],
      bio: '',
      jobTitle: '',
      city: 'Mumbai',
      interests: [],
      photos: ['https://example.com/a.jpg'],
      approxLat: 19,
      approxLng: 72,
      isOnboarded: true,
      isVisible: true,
      isBanned: false,
      isDeleted: false,
      lastActiveAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    breakdown: {
      total,
      distanceKm,
      distanceScore: 0.8,
      interestOverlapScore: 0.5,
      sharedInterests,
      ageFitScore: 1,
      activityScore: 1,
      completenessScore: 1,
      reasons: [],
    },
  });

  const list = [
    makeCandidate('a', 91, 4.2, ['Specialty Coffee']),
    makeCandidate('b', 74, 8.5, []),
    makeCandidate('c', 83, 18.0, ['Live Jazz']),
  ];

  assert.equal(filterRankedCandidates(list, 'all').length, 3);
  assert.deepEqual(
    filterRankedCandidates(list, 'high_match').map((c) => c.profile.uid),
    ['a', 'c']
  );
  assert.deepEqual(
    filterRankedCandidates(list, 'shared_interests').map((c) => c.profile.uid),
    ['a', 'c']
  );
  assert.deepEqual(
    filterRankedCandidates(list, 'nearby_10km').map((c) => c.profile.uid),
    ['a', 'b']
  );
});
