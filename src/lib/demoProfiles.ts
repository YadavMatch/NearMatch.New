import type { PublicProfile } from '../types/models';
import { DEMO_IMAGES } from './constants';

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

export const DEMO_PROFILES: PublicProfile[] = [
  {
    uid: 'demo_diya',
    displayName: 'Diya Nair',
    age: 26,
    gender: 'woman',
    interestedIn: ['man', 'woman', 'non_binary', 'other'],
    bio: 'Product designer who plans weekend errands around filter kaapi stops and old single-screen theatres. Always down for an evening walk by Carter Road.',
    jobTitle: 'Product Designer',
    city: 'Bandra West, Mumbai',
    interests: ['Specialty Coffee', 'Indie Cinema', 'Coastal Walks', 'Architecture', 'Bookstores'],
    photos: [DEMO_IMAGES.diya],
    approxLat: 19.0604,
    approxLng: 72.8312,
    isOnboarded: true,
    isVisible: true,
    isBanned: false,
    isDeleted: false,
    lastActiveAt: hoursAgo(2),
    createdAt: hoursAgo(120),
    updatedAt: hoursAgo(2),
    connectionGoal: 'Long-term partner',
    storySparks: [
      {
        question: 'My ideal Sunday morning looks like',
        answer: 'Filter kaapi on Pali Hill, a slow browse at an independent bookshop, and zero alarms.',
      },
      {
        question: 'A local neighborhood spot I keep coming back to',
        answer: 'The quiet corner steps near Carter Road right as golden hour starts.',
      },
    ],
    isProfileVerified: true,
    isSelfieVerified: true,
    isDemo: true,
  },
  {
    uid: 'demo_kabir',
    displayName: 'Kabir Mehta',
    age: 29,
    gender: 'man',
    interestedIn: ['woman', 'man', 'non_binary', 'other'],
    bio: 'Acoustic sound engineer & weekend sourdough baker. Looking for someone who enjoys vinyl listening bars, late-night street food, and unhurried Sundays.',
    jobTitle: 'Audio Engineer',
    city: 'Lower Parel, Mumbai',
    interests: ['Vinyl Records', 'Live Jazz', 'Home Cooking', 'Street Food', 'Photography'],
    photos: [DEMO_IMAGES.kabir],
    approxLat: 18.9985,
    approxLng: 72.8318,
    isOnboarded: true,
    isVisible: true,
    isBanned: false,
    isDeleted: false,
    lastActiveAt: hoursAgo(5),
    createdAt: hoursAgo(160),
    updatedAt: hoursAgo(5),
    connectionGoal: 'Intentional dating',
    storySparks: [
      {
        question: 'Two truths and a gentle confession',
        answer: 'I keep a starter named Loafy, I know every jazz cafe in town, and I still burn garlic bread.',
      },
      {
        question: 'Green flags I always notice right away',
        answer: 'Someone who is kind to waitstaff and genuinely curious about the small details.',
      },
    ],
    isProfileVerified: true,
    isSelfieVerified: true,
    isDemo: true,
  },
  {
    uid: 'demo_meera',
    displayName: 'Meera Kapoor',
    age: 27,
    gender: 'woman',
    interestedIn: ['man', 'woman', 'non_binary', 'other'],
    bio: 'Curatorial researcher spending Saturdays in Kala Ghoda galleries and Sundays hunting for small-batch ceramics and botanical sketchbooks.',
    jobTitle: 'Curatorial Researcher',
    city: 'Colaba, Mumbai',
    interests: ['Art Galleries', 'Ceramics', 'Botanical Gardens', 'Bookstores', 'Specialty Coffee'],
    photos: [DEMO_IMAGES.meera],
    approxLat: 18.9082,
    approxLng: 72.8161,
    isOnboarded: true,
    isVisible: true,
    isBanned: false,
    isDeleted: false,
    lastActiveAt: hoursAgo(14),
    createdAt: hoursAgo(210),
    updatedAt: hoursAgo(14),
    connectionGoal: 'Long-term partner',
    storySparks: [
      {
        question: 'Something I am quietly excited about this year',
        answer: 'Throwing my first balanced stoneware teapot without it collapsing on the wheel.',
      },
    ],
    isProfileVerified: true,
    isSelfieVerified: true,
    isDemo: true,
  },
  {
    uid: 'demo_rohan',
    displayName: 'Rohan Deshmukh',
    age: 30,
    gender: 'man',
    interestedIn: ['woman', 'man', 'non_binary', 'other'],
    bio: 'Urban architect obsessed with heritage conservation, dawn cycling loops along Marine Drive, and finding the best monsoon chai corners.',
    jobTitle: 'Conservation Architect',
    city: 'Juhu, Mumbai',
    interests: ['Architecture', 'Cycling', 'Trail Running', 'Photography', 'Coastal Walks'],
    photos: [DEMO_IMAGES.rohan],
    approxLat: 19.1045,
    approxLng: 72.8267,
    isOnboarded: true,
    isVisible: true,
    isBanned: false,
    isDeleted: false,
    lastActiveAt: hoursAgo(30),
    createdAt: hoursAgo(300),
    updatedAt: hoursAgo(30),
    connectionGoal: 'Intentional dating',
    storySparks: [
      {
        question: 'The fastest way to make me laugh is',
        answer: 'Showing up with an overly ambitious weekend itinerary and abandoning it for monsoon chai.',
      },
    ],
    isProfileVerified: true,
    isSelfieVerified: true,
    isDemo: true,
  },
  {
    uid: 'demo_ananya',
    displayName: 'Ananya Rao',
    age: 25,
    gender: 'woman',
    interestedIn: ['woman', 'man', 'non_binary', 'other'],
    bio: 'Documentary editor who collects indie zines, hosts competitive Catan nights, and rates every neighborhood solely by its corner bakery.',
    jobTitle: 'Documentary Editor',
    city: 'Powai, Mumbai',
    interests: ['Indie Cinema', 'Board Games', 'Home Cooking', 'Botanical Gardens', 'Street Food'],
    photos: [DEMO_IMAGES.ananya],
    approxLat: 19.1197,
    approxLng: 72.9051,
    isOnboarded: true,
    isVisible: true,
    isBanned: false,
    isDeleted: false,
    lastActiveAt: hoursAgo(9),
    createdAt: hoursAgo(95),
    updatedAt: hoursAgo(9),
    connectionGoal: 'Taking it slow',
    storySparks: [
      {
        question: 'My ideal Sunday morning looks like',
        answer: 'Fresh cardamom buns, a film review podcast, and planning the next Catan tournament.',
      },
    ],
    isProfileVerified: true,
    isSelfieVerified: true,
    isDemo: true,
  },
];

export function shouldDemoReciprocate(
  demoId: string,
  action: 'like' | 'superlike'
): boolean {
  if (action === 'superlike') return true;
  return demoId === 'demo_diya' || demoId === 'demo_kabir' || demoId === 'demo_ananya';
}

export function buildDemoGreeting(
  demoName: string,
  sharedInterests: string[]
): string {
  const firstName = demoName.split(' ')[0];
  if (sharedInterests.length > 0) {
    return `Hey! Saw we both enjoy ${sharedInterests[0].toLowerCase()}. Have a favorite spot around town?`;
  }
  return `Hi there! Great matching with you — I'm ${firstName}. How's your week treating you?`;
}

export function buildDemoReply(
  demoName: string,
  userMessage: string,
  sharedInterests: string[],
  isVoiceNote = false
): string {
  const firstName = demoName.split(' ')[0];
  if (isVoiceNote) {
    if (sharedInterests.length > 0) {
      return `Loved hearing your voice! Now I'm even more excited to swap notes about ${sharedInterests[0].toLowerCase()} in person.`;
    }
    return `Loved hearing your voice note! It's so much warmer than plain text — how's the rest of your day shaping up?`;
  }
  const lower = userMessage.toLowerCase();
  if (lower.includes('coffee') || lower.includes('chai') || lower.includes('cafe')) {
    return `Always up for a good pour-over. There's a quiet roastery near Bandra that never feels rushed — would love to compare favorites!`;
  }
  if (lower.includes('weekend') || lower.includes('free') || lower.includes('meet')) {
    return `Saturday late afternoon usually works well for me, especially if we pair it with a coastal walk before sunset.`;
  }
  if (sharedInterests.length > 0) {
    return `That sounds great! Between ${sharedInterests.slice(0, 2).join(' and ')}, we definitely won't run out of things to talk about.`;
  }
  return `Love that energy! ${firstName} here — tell me what's been the highlight of your week so far.`;
}
