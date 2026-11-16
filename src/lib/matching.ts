import type {
  CandidateScoreBreakdown,
  PrivateAccount,
  PublicProfile,
  RankedCandidate,
  SwipeRecord,
} from '../types/models';

const EARTH_RADIUS_KM = 6371;
const GRID_LAT_STEP = 0.0027; // ~300m latitude cell

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Deterministic ~300m privacy grid snapping.
 * Uses the snapped latitude when computing longitude step so repeated saves are idempotent.
 */
export function jitterForPrivacy(
  lat: number,
  lng: number,
  seedUid: string
): { approxLat: number; approxLng: number } {
  let hash = 2166136261;
  for (let i = 0; i < seedUid.length; i += 1) {
    hash ^= seedUid.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const snappedLat = Math.round(lat / GRID_LAT_STEP) * GRID_LAT_STEP;
  const cosLat = Math.max(0.2, Math.cos(toRad(snappedLat)));
  const lngStep = GRID_LAT_STEP / cosLat;
  const snappedLng = Math.round(lng / lngStep) * lngStep;

  const latBias = (((hash >>> 0) % 100) / 100 - 0.5) * 0.0004;
  const lngBias = ((((hash >>> 8) % 100) / 100) - 0.5) * 0.0004;

  const approxLat = Math.max(-89.9, Math.min(89.9, Number((snappedLat + latBias).toFixed(5))));
  const approxLng = Math.max(-179.9, Math.min(179.9, Number((snappedLng + lngBias).toFixed(5))));
  return { approxLat, approxLng };
}

export function displayDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return 'Nearby';
  if (km < 1) return '< 1 km away';
  return `${Math.round(km)} km away`;
}

export function ageFromDob(dob: string, refDate: Date = new Date()): number | null {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dob);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const birth = new Date(Date.UTC(year, month, day));
  if (
    birth.getUTCFullYear() !== year ||
    birth.getUTCMonth() !== month ||
    birth.getUTCDate() !== day
  ) {
    return null;
  }
  let age = refDate.getUTCFullYear() - year;
  const mDiff = refDate.getUTCMonth() - month;
  if (mDiff < 0 || (mDiff === 0 && refDate.getUTCDate() < day)) {
    age -= 1;
  }
  return age;
}

export function profileCompleteness(profile: PublicProfile): number {
  let score = 0;
  if (profile.bio.trim().length >= 20) score += 0.25;
  if (profile.jobTitle.trim().length >= 2) score += 0.2;
  if (profile.city.trim().length >= 2) score += 0.15;
  if (profile.interests.length >= 3) score += 0.2;
  if (profile.photos.length >= 1) score += 0.2;
  return Math.min(1, Number(score.toFixed(2)));
}

export interface EligibilityContext {
  swipedIds: Set<string>;
  blockedIds: Set<string>;
  tasteWeights?: Map<string, number>;
}

export function rejectionReason(
  viewer: PublicProfile,
  prefs: Pick<PrivateAccount, 'minAge' | 'maxAge' | 'maxDistanceKm' | 'strictAgeBoundary'>,
  candidate: PublicProfile,
  ctx: EligibilityContext
): string | null {
  if (candidate.uid === viewer.uid) return 'self';
  if (!candidate.isOnboarded) return 'not_onboarded';
  if (!candidate.isVisible) return 'hidden';
  if (candidate.isBanned || candidate.isDeleted) return 'inactive';
  if (ctx.blockedIds.has(candidate.uid)) return 'blocked';
  if (ctx.swipedIds.has(candidate.uid)) return 'already_swiped';
  if (candidate.age < 18) return 'underage';

  // Soft +-2 year grace around viewer preference range unless Strict Age Boundary is enabled
  const graceYears = prefs.strictAgeBoundary ? 0 : 2;
  const minAccepted = Math.max(18, prefs.minAge - graceYears);
  const maxAccepted = Math.min(99, prefs.maxAge + graceYears);
  if (candidate.age < minAccepted || candidate.age > maxAccepted) return 'age_range';

  // Mutual gender / orientation check
  if (!viewer.interestedIn.includes(candidate.gender)) return 'viewer_orientation';
  if (!candidate.interestedIn.includes(viewer.gender)) return 'candidate_orientation';

  const dist = haversineKm(viewer.approxLat, viewer.approxLng, candidate.approxLat, candidate.approxLng);
  if (dist > prefs.maxDistanceKm) return 'distance';

  return null;
}

export function isEligible(
  viewer: PublicProfile,
  prefs: Pick<PrivateAccount, 'minAge' | 'maxAge' | 'maxDistanceKm' | 'strictAgeBoundary'>,
  candidate: PublicProfile,
  ctx: EligibilityContext
): boolean {
  return rejectionReason(viewer, prefs, candidate, ctx) === null;
}

export function computeTasteWeights(
  swipes: SwipeRecord[],
  profilesByUid: Map<string, PublicProfile>,
  preferredInterests: string[] = []
): Map<string, number> {
  const weights = new Map<string, number>();

  for (const tag of preferredInterests) {
    const key = tag.toLowerCase().trim();
    if (!key) continue;
    weights.set(key, (weights.get(key) ?? 0) + 1.5);
  }

  for (const swipe of swipes) {
    const profile = profilesByUid.get(swipe.targetId);
    if (!profile) continue;
    const delta = swipe.action === 'superlike' ? 1.4 : swipe.action === 'like' ? 1.0 : -0.4;
    for (const interest of profile.interests) {
      const key = interest.toLowerCase().trim();
      if (!key) continue;
      weights.set(key, (weights.get(key) ?? 0) + delta);
    }
  }

  return weights;
}

export function scoreCandidate(
  viewer: PublicProfile,
  prefs: Pick<PrivateAccount, 'minAge' | 'maxAge' | 'maxDistanceKm'>,
  candidate: PublicProfile,
  nowMs: number = Date.now(),
  tasteWeights?: Map<string, number>
): CandidateScoreBreakdown {
  const distanceKm = haversineKm(
    viewer.approxLat,
    viewer.approxLng,
    candidate.approxLat,
    candidate.approxLng
  );

  // 1. Distance score (weight 0.34): half-life 25km + cubic edge taper at maxDistanceKm
  const decay = Math.exp((-Math.LN2 * distanceKm) / 25);
  const ratio = Math.min(1, distanceKm / Math.max(5, prefs.maxDistanceKm));
  const edgeTaper = 1 - Math.pow(ratio, 3) * 0.45;
  const distanceScore = Math.max(0, Math.min(1, decay * edgeTaper));

  // 2. Jaccard interest overlap (weight 0.24)
  const viewerSet = new Set(viewer.interests.map((x) => x.toLowerCase().trim()));
  const candSet = new Set(candidate.interests.map((x) => x.toLowerCase().trim()));
  const sharedInterests = candidate.interests.filter((x) => viewerSet.has(x.toLowerCase().trim()));
  let interestOverlapScore = 0.35;
  if (viewerSet.size > 0 && candSet.size > 0) {
    const unionSize = new Set([...viewerSet, ...candSet]).size;
    interestOverlapScore = unionSize > 0 ? sharedInterests.length / unionSize : 0.35;
  }

  // 3. Age fit (weight 0.16)
  let ageFitScore = 1;
  if (candidate.age < prefs.minAge || candidate.age > prefs.maxAge) {
    const delta =
      candidate.age < prefs.minAge ? prefs.minAge - candidate.age : candidate.age - prefs.maxAge;
    ageFitScore = Math.max(0.25, 1 - delta * 0.25);
  } else {
    const center = (prefs.minAge + prefs.maxAge) / 2;
    const halfSpan = Math.max(1, (prefs.maxAge - prefs.minAge) / 2);
    ageFitScore = 1 - Math.min(0.25, (Math.abs(candidate.age - center) / halfSpan) * 0.2);
  }

  // 4. Activity freshness (weight 0.14)
  const ageDays = Math.max(0, (nowMs - candidate.lastActiveAt.getTime()) / 86_400_000);
  let activityScore = 0.15;
  if (ageDays <= 1) activityScore = 1;
  else if (ageDays <= 3) activityScore = 0.85;
  else if (ageDays <= 7) activityScore = 0.65;
  else if (ageDays <= 30) activityScore = 0.35;

  // 5. Profile completeness (weight 0.12)
  const completenessScore = profileCompleteness(candidate);

  // 6. Taste calibration adjustment (-0.04 to +0.06) based on past swipes & Real-Life Check-Ins
  let tasteBoostScore = 0;
  if (tasteWeights && tasteWeights.size > 0 && candidate.interests.length > 0) {
    let sum = 0;
    for (const interest of candidate.interests) {
      sum += tasteWeights.get(interest.toLowerCase().trim()) ?? 0;
    }
    const normalized = sum / Math.max(1, candidate.interests.length);
    tasteBoostScore = Math.max(-0.04, Math.min(0.06, normalized * 0.025));
  }

  const weighted =
    0.34 * distanceScore +
    0.24 * interestOverlapScore +
    0.16 * ageFitScore +
    0.14 * activityScore +
    0.12 * completenessScore +
    tasteBoostScore;

  const total = Math.max(1, Math.min(99, Math.round(weighted * 100)));

  const reasons: string[] = [];
  reasons.push(distanceKm < 1 ? 'Less than 1 km away' : `${distanceKm.toFixed(1)} km from you`);
  if (sharedInterests.length > 0) {
    reasons.push(
      `${sharedInterests.length} shared interest${sharedInterests.length > 1 ? 's' : ''}: ${sharedInterests
        .slice(0, 2)
        .join(', ')}`
    );
  }
  if (ageDays <= 1) reasons.push('Active today');
  else if (ageDays <= 3) reasons.push('Active this week');
  if (completenessScore >= 0.85) reasons.push('Thoughtful complete profile');
  if (candidate.connectionGoal && viewer.connectionGoal === candidate.connectionGoal) {
    reasons.push(`Aligned goal: ${candidate.connectionGoal}`);
  }

  return {
    total,
    distanceKm,
    distanceScore,
    interestOverlapScore,
    sharedInterests,
    ageFitScore,
    activityScore,
    completenessScore,
    tasteBoostScore,
    reasons,
  };
}

function distanceBand(km: number): number {
  if (km <= 5) return 0;
  if (km <= 15) return 1;
  if (km <= 35) return 2;
  return 3;
}

/**
 * Diversify ranked candidates across distance bands (2-per-band round-robin)
 * so the top of the deck balances immediate proximity with wider discovery.
 */
export function diversify(scored: RankedCandidate[]): RankedCandidate[] {
  const sorted = [...scored].sort((a, b) => b.breakdown.total - a.breakdown.total);
  const buckets: RankedCandidate[][] = [[], [], [], []];
  for (const item of sorted) {
    buckets[distanceBand(item.breakdown.distanceKm)].push(item);
  }

  const result: RankedCandidate[] = [];
  let remaining = sorted.length;
  while (remaining > 0) {
    let progressed = false;
    for (const bucket of buckets) {
      for (let take = 0; take < 2 && bucket.length > 0; take += 1) {
        const next = bucket.shift();
        if (next) {
          result.push(next);
          remaining -= 1;
          progressed = true;
        }
      }
    }
    if (!progressed) break;
  }
  return result;
}

export function rankCandidates(
  viewer: PublicProfile,
  prefs: Pick<PrivateAccount, 'minAge' | 'maxAge' | 'maxDistanceKm' | 'strictAgeBoundary'>,
  candidates: PublicProfile[],
  ctx: EligibilityContext,
  nowMs: number = Date.now()
): RankedCandidate[] {
  const eligible = candidates
    .filter((candidate) => isEligible(viewer, prefs, candidate, ctx))
    .map((profile) => ({
      profile,
      breakdown: scoreCandidate(viewer, prefs, profile, nowMs, ctx.tasteWeights),
    }));

  return diversify(eligible);
}

/**
 * Selects "Today's Mutual Pick" using bidirectional compatibility:
 * balances viewer's fit for candidate AND candidate's likely fit for viewer
 * (shared interests, connection goal alignment, and age proximity).
 */
export function selectDailyMutualPick(
  viewer: PublicProfile,
  rankedCandidates: RankedCandidate[],
  date: Date = new Date()
): RankedCandidate | null {
  if (rankedCandidates.length === 0) return null;

  const dayKey = date.getFullYear() * 1000 + date.getMonth() * 40 + date.getDate();

  const scoredMutual = rankedCandidates.map((item) => {
    const goalBonus =
      viewer.connectionGoal && item.profile.connectionGoal === viewer.connectionGoal ? 8 : 0;
    const sparkBonus = (item.profile.storySparks?.length ?? 0) > 0 ? 4 : 0;
    const verifiedBonus =
      item.profile.isProfileVerified && item.profile.isSelfieVerified ? 5 : 0;
    const ageDelta = Math.abs(viewer.age - item.profile.age);
    const reverseAgeFit = Math.max(0, 12 - ageDelta * 1.5);
    const reverseInterestFit = item.breakdown.interestOverlapScore * 20;
    const dayJitter = ((dayKey + item.profile.uid.charCodeAt(0)) % 5) * 0.6;

    const mutualScore =
      item.breakdown.total * 0.7 +
      reverseAgeFit +
      reverseInterestFit +
      goalBonus +
      sparkBonus +
      verifiedBonus +
      dayJitter;

    return { item, mutualScore };
  });

  scoredMutual.sort((a, b) => b.mutualScore - a.mutualScore);
  return scoredMutual[0]?.item ?? null;
}

export function selectCuratedHighlights(
  rankedCandidates: RankedCandidate[],
  excludeUid?: string | null,
  maxCount = 3
): RankedCandidate[] {
  return [...rankedCandidates]
    .filter((item) => item.profile.uid !== excludeUid)
    .sort((a, b) => {
      const scoreA =
        a.breakdown.total +
        a.breakdown.sharedInterests.length * 4 +
        ((a.profile.storySparks?.length ?? 0) > 0 ? 3 : 0);
      const scoreB =
        b.breakdown.total +
        b.breakdown.sharedInterests.length * 4 +
        ((b.profile.storySparks?.length ?? 0) > 0 ? 3 : 0);
      return scoreB - scoreA;
    })
    .slice(0, maxCount);
}
