export interface IcebreakerSuggestion {
  id: string;
  interest: string | null;
  question: string;
  isCommonInterest: boolean;
}

const INTEREST_ICEBREAKER_MAP: Record<string, string[]> = {
  'specialty coffee': [
    "Since we're both into specialty coffee—what's your go-to order, and which café around here actually nails it?",
    'Pour-over purist or iced latte year-round? Always looking for a new coffee ritual.',
  ],
  'indie cinema': [
    "We both love indie cinema! What's a film you watched recently that stayed in your head for days?",
    'If you could program a double feature at a classic neighborhood theatre, which two movies would you pick?',
  ],
  'coastal walks': [
    'Fellow coastal walk fan here—quiet sunrise breeze or golden-hour sunset stroll by the water?',
    'Do you have a favorite stretch by the water where you go to clear your head?',
  ],
  'art galleries': [
    'Saw we both enjoy art galleries. Have you seen an exhibition lately that genuinely surprised you?',
    'Are you a slow reader of every plaque in the gallery, or do you wander until one piece stops you?',
  ],
  'vinyl records': [
    "Since we share vinyl records—what's the one album you'd put on first for an unhurried Sunday?",
    'What was the last record you picked up that felt like an instant treasure?',
  ],
  'street food': [
    "Two street food fans! What's the one local stall or late-night bite you'd always take someone new to?",
    "Savory crunch or something sweet—what's your ultimate street food weakness?",
  ],
  'trail running': [
    'Fellow trail runner! Do you chase early sunrise miles or unwind with an evening run?',
    "What's your favorite trail loop when you want green trees and zero traffic?",
  ],
  ceramics: [
    'We both appreciate ceramics—do you collect handmade mugs or have you ever tried throwing on the wheel?',
    'Is there a local studio or maker whose pieces you always look out for?',
  ],
  bookstores: [
    "Since we both love bookstores—which neighborhood shop do you accidentally spend an hour in every time?",
    "What's sitting on top of your nightstand reading stack right now?",
  ],
  architecture: [
    'Fellow architecture fan! Is there a street or heritage building nearby you always catch yourself looking up at?',
    'Warm old-world stonework or clean modern timber—what kind of space makes you feel most at home?',
  ],
  'live jazz': [
    "We both love live jazz—what's your favorite spot for great acoustics and an unhurried evening?",
    'Classic mellow quartet or upbeat late-night brass—what kind of set pulls you in?',
  ],
  'home cooking': [
    "Since we both enjoy home cooking, what's the comfort dish you genuinely look forward to making on weekends?",
    'Are you a strict recipe follower or someone who cooks by instinct and a little chaos?',
  ],
  photography: [
    'Saw we share photography—are you drawn more to candid street frames, golden-hour light, or film?',
    "What's a small everyday scene you never get tired of photographing?",
  ],
  cycling: [
    "Fellow cyclist! What's your favorite early-morning route before the streets wake up?",
    'Long weekend endurance rides or relaxed café-stop spins around town?',
  ],
  'board games': [
    "Since we're both into board games—co-op strategy or friendly, fiercely competitive game nights?",
    'Which game is guaranteed to bring out your playful competitive side?',
  ],
  'botanical gardens': [
    'Two botanical garden fans—do you go to wander quietly, take photos, or hunt down hidden greenhouses?',
    'Are you trying to keep any ambitious houseplants alive at home right now?',
  ],
};

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function stableHash(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Extracts common interest tags between the viewer and partner, falling back
 * to parsing "shared interest(s): ..." from matchReasons if full partner profile
 * interests are temporarily unavailable.
 */
export function detectCommonInterests(
  viewerInterests: string[],
  partnerInterests: string[] = [],
  matchReasons: string[] = []
): string[] {
  const viewerMap = new Map<string, string>();
  for (const tag of viewerInterests) {
    const clean = tag.trim();
    if (clean) viewerMap.set(normalizeTag(clean), clean);
  }

  const matched: string[] = [];
  const seen = new Set<string>();

  for (const tag of partnerInterests) {
    const clean = tag.trim();
    const key = normalizeTag(clean);
    if (clean && viewerMap.has(key) && !seen.has(key)) {
      seen.add(key);
      matched.push(viewerMap.get(key) ?? clean);
    }
  }

  if (matched.length > 0) {
    return matched;
  }

  // Fallback: inspect matchReasons like "2 shared interests: Specialty Coffee, Indie Cinema"
  for (const reason of matchReasons) {
    const match = /shared interests?:\s*(.+)$/i.exec(reason);
    if (!match) continue;
    const rawTags = match[1].split(',').map((s) => s.trim()).filter(Boolean);
    for (const tag of rawTags) {
      const key = normalizeTag(tag);
      if (!seen.has(key)) {
        seen.add(key);
        matched.push(viewerMap.get(key) ?? tag);
      }
    }
  }

  return matched;
}

export function buildIcebreakerSuggestions(params: {
  viewerInterests: string[];
  partnerInterests?: string[];
  matchReasons?: string[];
  partnerName: string;
  partnerCity?: string;
  conversationId: string;
  maxCount?: number;
}): IcebreakerSuggestion[] {
  const {
    viewerInterests,
    partnerInterests = [],
    matchReasons = [],
    partnerName,
    partnerCity,
    conversationId,
    maxCount = 3,
  } = params;

  const common = detectCommonInterests(viewerInterests, partnerInterests, matchReasons);
  const suggestions: IcebreakerSuggestion[] = [];
  const seedBase = stableHash(conversationId || partnerName);

  for (let i = 0; i < common.length && suggestions.length < maxCount; i += 1) {
    const tag = common[i];
    const key = normalizeTag(tag);
    const templates = INTEREST_ICEBREAKER_MAP[key];
    const question = templates
      ? templates[(seedBase + i) % templates.length]
      : `Since we both enjoy ${tag.toLowerCase()}, what got you into it—or do you have a favorite spot for it nearby?`;

    suggestions.push({
      id: `common_${key.replace(/\s+/g, '_')}`,
      interest: tag,
      question,
      isCommonInterest: true,
    });
  }

  // Add warm local/partner-specific fallbacks if fewer than maxCount common interests
  const firstName = partnerName.trim().split(/\s+/)[0] || 'there';
  const cityLabel = partnerCity?.trim() || 'your neighborhood';

  const fallbacks: IcebreakerSuggestion[] = [
    {
      id: 'fallback_local_spot',
      interest: null,
      question: `Hey ${firstName}! What's one underrated spot around ${cityLabel} you always love showing friends?`,
      isCommonInterest: false,
    },
    {
      id: 'fallback_weekend',
      interest: null,
      question: `What does a genuinely great, unhurried Sunday look like for you lately?`,
      isCommonInterest: false,
    },
    {
      id: 'fallback_curious',
      interest: null,
      question: `What's something small that made your week noticeably better so far?`,
      isCommonInterest: false,
    },
  ];

  for (const fb of fallbacks) {
    if (suggestions.length >= maxCount) break;
    suggestions.push(fb);
  }

  return suggestions;
}
