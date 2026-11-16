export type Gender = 'woman' | 'man' | 'non_binary' | 'other';
export type SwipeAction = 'like' | 'pass' | 'superlike';
export type ReportReason =
  | 'harassment'
  | 'fake_profile'
  | 'inappropriate_content'
  | 'spam'
  | 'underage'
  | 'other';

export type ConnectionGoal =
  | 'Long-term partner'
  | 'Intentional dating'
  | 'Taking it slow'
  | 'Still exploring';

export type VerificationDocType = 'passport' | 'national_id' | 'drivers_license';

export interface StorySpark {
  question: string;
  answer: string;
}

export interface PublicProfile {
  uid: string;
  displayName: string;
  age: number;
  gender: Gender;
  interestedIn: Gender[];
  bio: string;
  jobTitle: string;
  city: string;
  interests: string[];
  photos: string[];
  approxLat: number;
  approxLng: number;
  isOnboarded: boolean;
  isVisible: boolean;
  isBanned: boolean;
  isDeleted: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
  connectionGoal?: ConnectionGoal;
  storySparks?: StorySpark[];
  isProfileVerified?: boolean;
  isSelfieVerified?: boolean;
  securityCheckPending?: boolean;
  photoVerificationRequired?: boolean;
  lastVerifiedAt?: Date;
  isDemo?: boolean;
}

export interface PrivateAccount {
  uid: string;
  email: string;
  dob: string;
  minAge: number;
  maxAge: number;
  maxDistanceKm: number;
  showMe: boolean;
  createdAt: Date;
  updatedAt: Date;
  strictAgeBoundary?: boolean;
  strictDistanceBoundary?: boolean;
  verificationDocType?: VerificationDocType;
  verificationLast4?: string;
  verificationFullName?: string;
  firstVerifiedAt?: Date;
  lastSecurityCheckAt?: Date;
  chatsSinceSecurityCheck?: number;
  preferredInterests?: string[];
}

export interface SwipeRecord {
  id: string;
  actorId: string;
  targetId: string;
  action: SwipeAction;
  createdAt: Date;
  note?: string;
}

export interface ParticipantSummary {
  uid: string;
  displayName: string;
  age: number;
  photo: string;
  city: string;
  jobTitle: string;
}

export interface MatchRecord {
  id: string;
  userLow: string;
  userHigh: string;
  participants: [string, string];
  participantSummaries: Record<string, ParticipantSummary>;
  compatibilityScore: number;
  matchReasons: string[];
  isActive: boolean;
  lastMessageText?: string;
  lastMessageAt?: Date;
  lastMessageSenderId?: string;
  closedBy?: string;
  matchedAt: Date;
  updatedAt: Date;
}

export type MessageKind = 'text' | 'voice';

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  recipientId: string;
  body: string;
  clientId: string;
  sentAt: Date;
  readAt?: Date;
  pending?: boolean;
  kind?: MessageKind;
  voiceCiphertext?: string;
  voiceIv?: string;
  voiceMimeType?: string;
  voiceDurationSec?: number;
}

export interface BlockRecord {
  id: string;
  blockerId: string;
  blockedId: string;
  blockedName: string;
  createdAt: Date;
}

export interface ReportRecord {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: ReportReason;
  details: string;
  status: 'open';
  createdAt: Date;
}

export interface DemoMessage {
  id: string;
  senderId: string;
  body: string;
  sentAtIso: string;
  readAtIso?: string;
  kind?: MessageKind;
  voiceCiphertext?: string;
  voiceIv?: string;
  voiceMimeType?: string;
  voiceDurationSec?: number;
}

export interface DemoMatchRecord {
  id: string;
  ownerId: string;
  demoId: string;
  profileName: string;
  profileAge: number;
  profileCity: string;
  profileJobTitle: string;
  profilePhoto: string;
  compatibilityScore: number;
  matchReasons: string[];
  messages: DemoMessage[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidateScoreBreakdown {
  total: number;
  distanceKm: number;
  distanceScore: number;
  interestOverlapScore: number;
  sharedInterests: string[];
  ageFitScore: number;
  activityScore: number;
  completenessScore: number;
  tasteBoostScore?: number;
  reasons: string[];
}

export interface RankedCandidate {
  profile: PublicProfile;
  breakdown: CandidateScoreBreakdown;
}

export interface UnifiedConversation {
  kind: 'live' | 'demo';
  id: string;
  partnerUid: string;
  partnerName: string;
  partnerAge: number;
  partnerPhoto: string;
  partnerCity: string;
  partnerJobTitle: string;
  compatibilityScore: number;
  matchReasons: string[];
  lastMessageText: string;
  lastMessageAt: Date;
  lastMessageSenderId?: string;
  matchedAt: Date;
  unreadCount: number;
  demoMessages?: DemoMessage[];
}

export interface SwipeResult {
  matched: boolean;
  swipeId: string;
  conversation?: UnifiedConversation;
}
