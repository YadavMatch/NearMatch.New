import { detectCommonInterests } from './icebreakers.ts';
import type { RankedCandidate } from '../types/models';

export interface DateSpotSuggestion {
  id: string;
  title: string;
  vibe: string;
  inviteText: string;
}

export type DiscoverDeckFilter = 'all' | 'high_match' | 'shared_interests' | 'nearby_10km';

const INTEREST_DATE_SPOTS: Record<
  string,
  { title: string; vibe: string; template: (firstName: string, city: string) => string }
> = {
  'Specialty Coffee': {
    title: 'Afternoon pour-over tasting',
    vibe: 'Public · Daytime',
    template: (firstName, city) =>
      `Hey ${firstName}, would you like to grab a relaxed pour-over at a cozy cafe in ${city} this week?`,
  },
  'Indie Cinema': {
    title: 'Matinee screening & chai',
    vibe: 'Public · Casual',
    template: (firstName, city) =>
      `Hi ${firstName}! Want to catch an evening indie screening around ${city} and talk about it over chai after?`,
  },
  'Coastal Walks': {
    title: 'Golden-hour promenade walk',
    vibe: 'Public · Outdoors',
    template: (firstName, city) =>
      `Hey ${firstName}, up for a golden-hour walk along a lively waterfront or promenade in ${city} sometime soon?`,
  },
  'Art Galleries': {
    title: 'Weekend gallery hop',
    vibe: 'Public · Daytime',
    template: (firstName, city) =>
      `Hi ${firstName}! Would you enjoy wandering through a local art exhibition in ${city} together this weekend?`,
  },
  'Vinyl Records': {
    title: 'Listening bar & crate digging',
    vibe: 'Public · Early Evening',
    template: (firstName, city) =>
      `Hey ${firstName}, want to browse a record shop or check out a vinyl cafe around ${city}?`,
  },
  'Street Food': {
    title: 'Evening street-food crawl',
    vibe: 'Public · Lively',
    template: (firstName, city) =>
      `Hi ${firstName}! Care to swap favorite local food spots on a casual evening walk in ${city}?`,
  },
  'Trail Running': {
    title: 'Morning park loop & smoothies',
    vibe: 'Public · Morning',
    template: (firstName, city) =>
      `Hey ${firstName}, how about an easy morning jog or walk in a ${city} park followed by coffee?`,
  },
  Ceramics: {
    title: 'Pottery studio & espresso',
    vibe: 'Public · Creative',
    template: (firstName, city) =>
      `Hi ${firstName}! Would you be up for visiting a ceramics pop-up or craft studio in ${city}?`,
  },
  Bookstores: {
    title: 'Indie bookshop & cafe stop',
    vibe: 'Public · Daytime',
    template: (firstName, city) =>
      `Hey ${firstName}, want to browse an indie bookstore in ${city} and pick out a favorite read for each other?`,
  },
  Architecture: {
    title: 'Heritage walk & bakery stop',
    vibe: 'Public · Outdoors',
    template: (firstName, city) =>
      `Hi ${firstName}! Up for a weekend heritage walk around ${city} with a bakery stop along the way?`,
  },
  'Live Jazz': {
    title: 'Acoustic set & mocktails',
    vibe: 'Public · Evening',
    template: (firstName, city) =>
      `Hey ${firstName}, would you like to catch an early live jazz or acoustic set in ${city} this weekend?`,
  },
  'Home Cooking': {
    title: 'Farmers market stroll',
    vibe: 'Public · Morning',
    template: (firstName, city) =>
      `Hi ${firstName}! Want to stroll through a weekend market in ${city} and grab fresh pastries together?`,
  },
  Photography: {
    title: 'Sunset photo walk',
    vibe: 'Public · Outdoors',
    template: (firstName, city) =>
      `Hey ${firstName}, up for a relaxed sunset photo walk around a bustling neighborhood in ${city}?`,
  },
  Cycling: {
    title: 'Morning cycle & breakfast',
    vibe: 'Public · Morning',
    template: (firstName, city) =>
      `Hi ${firstName}! Would you enjoy an easy morning ride in ${city} ending at a good breakfast spot?`,
  },
  'Board Games': {
    title: 'Board game cafe match',
    vibe: 'Public · Playful',
    template: (firstName, city) =>
      `Hey ${firstName}, want to play a couple of quick rounds at a board game cafe in ${city}?`,
  },
  'Botanical Gardens': {
    title: 'Botanical garden stroll',
    vibe: 'Public · Daytime',
    template: (firstName, city) =>
      `Hi ${firstName}! Would you like to take a calm afternoon walk through a botanical garden in ${city}?`,
  },
};

const FALLBACK_SPOTS: {
  title: string;
  vibe: string;
  template: (firstName: string, city: string) => string;
}[] = [
  {
    title: 'Neighborhood coffee meetup',
    vibe: 'Public · Daytime',
    template: (firstName, city) =>
      `Hey ${firstName}, would you like to meet for a casual daytime coffee in ${city} this week?`,
  },
  {
    title: 'Artisan bakery & walk',
    vibe: 'Public · Casual',
    template: (firstName, city) =>
      `Hi ${firstName}! Up for grabbing pastries and taking a walk around ${city} sometime soon?`,
  },
  {
    title: 'Evening chai & sunset stroll',
    vibe: 'Public · Outdoors',
    template: (firstName, city) =>
      `Hey ${firstName}, want to grab an early evening chai in ${city} if your week looks open?`,
  },
];

export function buildDateSpotSuggestions(params: {
  viewerInterests: string[];
  partnerInterests: string[];
  matchReasons?: string[];
  partnerName: string;
  partnerCity: string;
  maxCount?: number;
}): DateSpotSuggestion[] {
  const firstName = params.partnerName.trim().split(/\s+/)[0] || 'there';
  const city = params.partnerCity.trim() || 'your neighborhood';
  const maxCount = Math.max(1, params.maxCount ?? 3);

  const shared = detectCommonInterests(
    params.viewerInterests,
    params.partnerInterests,
    params.matchReasons ?? []
  );

  const suggestions: DateSpotSuggestion[] = [];
  const usedTitles = new Set<string>();

  for (const tag of shared) {
    const match = INTEREST_DATE_SPOTS[tag];
    if (match && !usedTitles.has(match.title)) {
      usedTitles.add(match.title);
      suggestions.push({
        id: `spot_${tag.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        title: match.title,
        vibe: match.vibe,
        inviteText: match.template(firstName, city),
      });
    }
    if (suggestions.length >= maxCount) break;
  }

  for (let i = 0; i < FALLBACK_SPOTS.length && suggestions.length < maxCount; i++) {
    const fb = FALLBACK_SPOTS[i];
    if (!usedTitles.has(fb.title)) {
      usedTitles.add(fb.title);
      suggestions.push({
        id: `spot_fallback_${i}`,
        title: fb.title,
        vibe: fb.vibe,
        inviteText: fb.template(firstName, city),
      });
    }
  }

  return suggestions;
}

export function filterRankedCandidates(
  candidates: RankedCandidate[],
  filter: DiscoverDeckFilter
): RankedCandidate[] {
  if (filter === 'all') return candidates;
  if (filter === 'high_match') {
    return candidates.filter((c) => c.breakdown.total >= 80);
  }
  if (filter === 'shared_interests') {
    return candidates.filter((c) => c.breakdown.sharedInterests.length > 0);
  }
  if (filter === 'nearby_10km') {
    return candidates.filter((c) => c.breakdown.distanceKm <= 10);
  }
  return candidates;
}
