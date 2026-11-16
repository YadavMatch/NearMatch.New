import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { PORTRAIT_PRESETS, VOLUMETRIC_LIMITS } from './constants';
import { buildDemoGreeting, buildDemoReply, shouldDemoReciprocate } from './demoProfiles';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  buildCompositeId,
  buildMatchId,
  clampString,
  generateClientId,
  orderedPair,
} from './format';
import {
  buildSafetyCheckBody,
  getSafetyCheckAt,
  SAFETY_CHECK_MESSAGE_ID,
  SAFETY_CHECK_SENDER_ID,
} from './safetyCheck';
import { ageFromDob } from './matching';
import { havePhotosChanged, normalizePhotoList } from './photoGallery';
import { buildVoiceMessageSummary, type EncryptedVoicePayload } from './voiceCrypto';
import type {
  BlockRecord,
  ChatMessage,
  ConnectionGoal,
  DemoMatchRecord,
  DemoMessage,
  Gender,
  MatchRecord,
  MessageKind,
  ParticipantSummary,
  PrivateAccount,
  PublicProfile,
  RankedCandidate,
  ReportReason,
  StorySpark,
  SwipeAction,
  SwipeRecord,
  SwipeResult,
  UnifiedConversation,
  VerificationDocType,
} from '../types/models';

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}

function mapStorySparks(raw: unknown): StorySpark[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      question: clampString(String(item.question ?? ''), VOLUMETRIC_LIMITS.MAX_SPARK_QUESTION_LEN),
      answer: clampString(String(item.answer ?? ''), VOLUMETRIC_LIMITS.MAX_SPARK_ANSWER_LEN),
    }))
    .filter((item) => item.question.length > 0 && item.answer.length > 0)
    .slice(0, VOLUMETRIC_LIMITS.MAX_SPARKS);
}

function mapProfile(id: string, data: Record<string, unknown>): PublicProfile {
  return {
    uid: String(data.uid ?? id),
    displayName: String(data.displayName ?? ''),
    age: Number(data.age ?? 18),
    gender: (data.gender as Gender) ?? 'other',
    interestedIn: Array.isArray(data.interestedIn) ? (data.interestedIn as Gender[]) : ['woman', 'man'],
    bio: String(data.bio ?? ''),
    jobTitle: String(data.jobTitle ?? ''),
    city: String(data.city ?? ''),
    interests: Array.isArray(data.interests) ? data.interests.map(String) : [],
    photos: Array.isArray(data.photos) ? data.photos.map(String) : [],
    approxLat: Number(data.approxLat ?? 19.0596),
    approxLng: Number(data.approxLng ?? 72.8295),
    isOnboarded: Boolean(data.isOnboarded),
    isVisible: Boolean(data.isVisible),
    isBanned: Boolean(data.isBanned),
    isDeleted: Boolean(data.isDeleted),
    lastActiveAt: toDate(data.lastActiveAt),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    connectionGoal: data.connectionGoal ? (String(data.connectionGoal) as ConnectionGoal) : undefined,
    storySparks: mapStorySparks(data.storySparks),
    isProfileVerified: Boolean(data.isProfileVerified),
    isSelfieVerified: Boolean(data.isSelfieVerified),
    securityCheckPending: Boolean(data.securityCheckPending),
    photoVerificationRequired: Boolean(data.photoVerificationRequired),
    lastVerifiedAt: data.lastVerifiedAt ? toDate(data.lastVerifiedAt) : undefined,
  };
}

function mapPrivateAccount(uid: string, data: Record<string, unknown>): PrivateAccount {
  return {
    uid: String(data.uid ?? uid),
    email: String(data.email ?? ''),
    dob: String(data.dob ?? '1997-06-15'),
    minAge: Number(data.minAge ?? 21),
    maxAge: Number(data.maxAge ?? 36),
    maxDistanceKm: Number(data.maxDistanceKm ?? 35),
    showMe: Boolean(data.showMe ?? true),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    strictAgeBoundary: Boolean(data.strictAgeBoundary),
    strictDistanceBoundary: Boolean(data.strictDistanceBoundary),
    verificationDocType: data.verificationDocType
      ? (String(data.verificationDocType) as VerificationDocType)
      : undefined,
    verificationLast4: data.verificationLast4 ? String(data.verificationLast4) : undefined,
    verificationFullName: data.verificationFullName ? String(data.verificationFullName) : undefined,
    firstVerifiedAt: data.firstVerifiedAt ? toDate(data.firstVerifiedAt) : undefined,
    lastSecurityCheckAt: data.lastSecurityCheckAt ? toDate(data.lastSecurityCheckAt) : undefined,
    chatsSinceSecurityCheck:
      typeof data.chatsSinceSecurityCheck === 'number' ? data.chatsSinceSecurityCheck : 0,
    preferredInterests: Array.isArray(data.preferredInterests)
      ? data.preferredInterests.map(String)
      : [],
  };
}

function mapMatch(id: string, data: Record<string, unknown>): MatchRecord {
  return {
    id,
    userLow: String(data.userLow ?? ''),
    userHigh: String(data.userHigh ?? ''),
    participants: (data.participants as [string, string]) ?? ['', ''],
    participantSummaries: (data.participantSummaries as Record<string, ParticipantSummary>) ?? {},
    compatibilityScore: Number(data.compatibilityScore ?? 0),
    matchReasons: Array.isArray(data.matchReasons) ? data.matchReasons.map(String) : [],
    isActive: Boolean(data.isActive),
    lastMessageText: data.lastMessageText ? String(data.lastMessageText) : undefined,
    lastMessageAt: data.lastMessageAt ? toDate(data.lastMessageAt) : undefined,
    lastMessageSenderId: data.lastMessageSenderId ? String(data.lastMessageSenderId) : undefined,
    closedBy: data.closedBy ? String(data.closedBy) : undefined,
    matchedAt: toDate(data.matchedAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function mapDemoMatch(id: string, data: Record<string, unknown>): DemoMatchRecord {
  return {
    id,
    ownerId: String(data.ownerId ?? ''),
    demoId: String(data.demoId ?? id),
    profileName: String(data.profileName ?? ''),
    profileAge: Number(data.profileAge ?? 25),
    profileCity: String(data.profileCity ?? ''),
    profileJobTitle: String(data.profileJobTitle ?? ''),
    profilePhoto: String(data.profilePhoto ?? ''),
    compatibilityScore: Number(data.compatibilityScore ?? 80),
    matchReasons: Array.isArray(data.matchReasons) ? data.matchReasons.map(String) : [],
    messages: Array.isArray(data.messages) ? (data.messages as DemoMessage[]) : [],
    isActive: Boolean(data.isActive),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function subscribeMyProfile(
  uid: string,
  onData: (profile: PublicProfile | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `profiles/${uid}`;
  return onSnapshot(
    doc(db, 'profiles', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
      } else {
        onData(mapProfile(snap.id, snap.data()));
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}

export function subscribeMyPrivateAccount(
  uid: string,
  onData: (account: PrivateAccount | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `profiles/${uid}/private/info`;
  return onSnapshot(
    doc(db, 'profiles', uid, 'private', 'info'),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
      } else {
        onData(mapPrivateAccount(uid, snap.data()));
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}

export function subscribeDiscoveryProfiles(
  onData: (profiles: PublicProfile[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'profiles';
  const q = query(collection(db, 'profiles'), where('isVisible', '==', true), limit(60));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => mapProfile(d.id, d.data()));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}

export function subscribeMySwipes(
  uid: string,
  onData: (swipes: SwipeRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'swipes';
  const q = query(collection(db, 'swipes'), where('actorId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SwipeRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          actorId: String(data.actorId ?? ''),
          targetId: String(data.targetId ?? ''),
          action: data.action as SwipeAction,
          createdAt: toDate(data.createdAt),
          note: data.note ? String(data.note) : undefined,
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}

export function subscribeMyBlocks(
  uid: string,
  onData: (blocks: BlockRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'blocks';
  const q = query(collection(db, 'blocks'), where('blockerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: BlockRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          blockerId: String(data.blockerId ?? ''),
          blockedId: String(data.blockedId ?? ''),
          blockedName: String(data.blockedName ?? 'Member'),
          createdAt: toDate(data.createdAt),
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}

export function subscribeLiveMatches(
  uid: string,
  onData: (matches: MatchRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'matches';
  const q = query(collection(db, 'matches'), where('participants', 'array-contains', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const active = snapshot.docs
        .map((d) => mapMatch(d.id, d.data()))
        .filter((m) => m.isActive)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      onData(active);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}

export function subscribeDemoMatches(
  uid: string,
  onData: (matches: DemoMatchRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `profiles/${uid}/demoMatches`;
  const q = query(collection(db, 'profiles', uid, 'demoMatches'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const active = snapshot.docs
        .map((d) => mapDemoMatch(d.id, d.data()))
        .filter((m) => m.isActive)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      onData(active);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}

export function subscribeLiveMessages(
  matchId: string,
  onData: (messages: ChatMessage[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `matches/${matchId}/messages`;
  const q = query(collection(db, 'matches', matchId, 'messages'), orderBy('sentAt', 'asc'), limit(120));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ChatMessage[] = snapshot.docs.map((d) => {
        const data = d.data({ serverTimestamps: 'estimate' });
        return {
          id: d.id,
          matchId: String(data.matchId ?? matchId),
          senderId: String(data.senderId ?? ''),
          recipientId: String(data.recipientId ?? ''),
          body: String(data.body ?? ''),
          clientId: String(data.clientId ?? d.id),
          sentAt: toDate(data.sentAt),
          readAt: data.readAt ? toDate(data.readAt) : undefined,
          pending: d.metadata.hasPendingWrites,
          kind: data.kind === 'voice' ? ('voice' as MessageKind) : ('text' as MessageKind),
          voiceCiphertext: data.voiceCiphertext ? String(data.voiceCiphertext) : undefined,
          voiceIv: data.voiceIv ? String(data.voiceIv) : undefined,
          voiceMimeType: data.voiceMimeType ? String(data.voiceMimeType) : undefined,
          voiceDurationSec:
            typeof data.voiceDurationSec === 'number' ? data.voiceDurationSec : undefined,
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}

export interface OnboardingPayload {
  uid: string;
  email: string;
  displayName: string;
  dob: string;
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
  minAge: number;
  maxAge: number;
  maxDistanceKm: number;
  connectionGoal?: ConnectionGoal;
  storySparks?: StorySpark[];
}

function sanitizeSparks(sparks?: StorySpark[]): StorySpark[] {
  if (!sparks) return [];
  return sparks
    .map((s) => ({
      question: clampString(s.question, VOLUMETRIC_LIMITS.MAX_SPARK_QUESTION_LEN),
      answer: clampString(s.answer, VOLUMETRIC_LIMITS.MAX_SPARK_ANSWER_LEN),
    }))
    .filter((s) => s.question.length > 0 && s.answer.length > 0)
    .slice(0, VOLUMETRIC_LIMITS.MAX_SPARKS);
}

export async function saveOnboarding(payload: OnboardingPayload): Promise<void> {
  const profileRef = doc(db, 'profiles', payload.uid);
  const privateRef = doc(db, 'profiles', payload.uid, 'private', 'info');
  const cleanSparks = sanitizeSparks(payload.storySparks);

  const safeProfile: Record<string, unknown> = {
    uid: payload.uid,
    displayName: clampString(payload.displayName, VOLUMETRIC_LIMITS.MAX_NAME_LEN) || 'Member',
    age: Math.max(VOLUMETRIC_LIMITS.MIN_AGE, Math.min(VOLUMETRIC_LIMITS.MAX_AGE, Math.round(payload.age))),
    gender: payload.gender,
    interestedIn: payload.interestedIn.slice(0, 4),
    bio: clampString(payload.bio, VOLUMETRIC_LIMITS.MAX_BIO_LEN),
    jobTitle: clampString(payload.jobTitle, VOLUMETRIC_LIMITS.MAX_JOB_LEN),
    city: clampString(payload.city, VOLUMETRIC_LIMITS.MAX_CITY_LEN),
    interests: payload.interests
      .map((i) => clampString(i, VOLUMETRIC_LIMITS.MAX_INTEREST_LEN))
      .filter(Boolean)
      .slice(0, VOLUMETRIC_LIMITS.MAX_INTERESTS),
    photos: normalizePhotoList(payload.photos),
    approxLat: Math.max(-90, Math.min(90, payload.approxLat)),
    approxLng: Math.max(-180, Math.min(180, payload.approxLng)),
    storySparks: cleanSparks,
    isOnboarded: true,
    isVisible: true,
    isBanned: false,
    isDeleted: false,
  };
  if (payload.connectionGoal) {
    safeProfile.connectionGoal = payload.connectionGoal;
  }

  const minAge = Math.max(VOLUMETRIC_LIMITS.MIN_AGE, Math.min(VOLUMETRIC_LIMITS.MAX_AGE, Math.round(payload.minAge)));
  const maxAge = Math.max(minAge, Math.min(VOLUMETRIC_LIMITS.MAX_AGE, Math.round(payload.maxAge)));
  const maxDistanceKm = Math.max(
    VOLUMETRIC_LIMITS.MIN_DISTANCE_KM,
    Math.min(VOLUMETRIC_LIMITS.MAX_DISTANCE_KM, Math.round(payload.maxDistanceKm))
  );

  try {
    const existingSnap = await getDoc(profileRef);
    const batch = writeBatch(db);

    if (!existingSnap.exists()) {
      batch.set(profileRef, {
        ...safeProfile,
        isProfileVerified: false,
        isSelfieVerified: false,
        securityCheckPending: false,
        photoVerificationRequired: false,
        lastActiveAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(privateRef, {
        uid: payload.uid,
        email: clampString(payload.email, 200),
        dob: payload.dob,
        minAge,
        maxAge,
        maxDistanceKm,
        showMe: true,
        strictAgeBoundary: false,
        strictDistanceBoundary: false,
        chatsSinceSecurityCheck: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = existingSnap.data();
      const existingPhotos = Array.isArray(existingData.photos) ? existingData.photos.map(String) : [];
      const photosChanged = havePhotosChanged(existingPhotos, safeProfile.photos as string[]);
      const updatePatch: Record<string, unknown> = {
        displayName: safeProfile.displayName,
        age: safeProfile.age,
        gender: safeProfile.gender,
        interestedIn: safeProfile.interestedIn,
        bio: safeProfile.bio,
        jobTitle: safeProfile.jobTitle,
        city: safeProfile.city,
        interests: safeProfile.interests,
        approxLat: safeProfile.approxLat,
        approxLng: safeProfile.approxLng,
        storySparks: cleanSparks,
        isOnboarded: true,
        isVisible: true,
        lastActiveAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (photosChanged) {
        updatePatch.photos = safeProfile.photos;
        updatePatch.isProfileVerified = false;
        updatePatch.isSelfieVerified = false;
        updatePatch.securityCheckPending = true;
        updatePatch.photoVerificationRequired = true;
      }
      if (payload.connectionGoal) {
        updatePatch.connectionGoal = payload.connectionGoal;
      }
      batch.update(profileRef, updatePatch);
      batch.update(privateRef, {
        dob: payload.dob,
        minAge,
        maxAge,
        maxDistanceKm,
        showMe: true,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `profiles/${payload.uid}`);
  }
}

export async function updateProfileDetails(
  uid: string,
  updates: {
    displayName: string;
    gender: Gender;
    interestedIn: Gender[];
    bio: string;
    jobTitle: string;
    city: string;
    interests: string[];
    photos: string[];
    previousPhotos?: string[];
    approxLat: number;
    approxLng: number;
    connectionGoal?: ConnectionGoal;
    storySparks?: StorySpark[];
  }
): Promise<{ photosChanged: boolean }> {
  const path = `profiles/${uid}`;
  const cleanPhotos = normalizePhotoList(updates.photos);
  const photosChanged = updates.previousPhotos
    ? havePhotosChanged(updates.previousPhotos, cleanPhotos)
    : true;

  const patch: Record<string, unknown> = {
    displayName: clampString(updates.displayName, VOLUMETRIC_LIMITS.MAX_NAME_LEN) || 'Member',
    gender: updates.gender,
    interestedIn: updates.interestedIn.slice(0, 4),
    bio: clampString(updates.bio, VOLUMETRIC_LIMITS.MAX_BIO_LEN),
    jobTitle: clampString(updates.jobTitle, VOLUMETRIC_LIMITS.MAX_JOB_LEN),
    city: clampString(updates.city, VOLUMETRIC_LIMITS.MAX_CITY_LEN),
    interests: updates.interests
      .map((i) => clampString(i, VOLUMETRIC_LIMITS.MAX_INTEREST_LEN))
      .filter(Boolean)
      .slice(0, VOLUMETRIC_LIMITS.MAX_INTERESTS),
    approxLat: Math.max(-90, Math.min(90, updates.approxLat)),
    approxLng: Math.max(-180, Math.min(180, updates.approxLng)),
    storySparks: sanitizeSparks(updates.storySparks),
    lastActiveAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (photosChanged) {
    patch.photos = cleanPhotos;
    patch.isProfileVerified = false;
    patch.isSelfieVerified = false;
    patch.securityCheckPending = true;
    patch.photoVerificationRequired = true;
  }
  if (updates.connectionGoal) {
    patch.connectionGoal = updates.connectionGoal;
  }

  try {
    await updateDoc(doc(db, 'profiles', uid), patch);
    return { photosChanged };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateDiscoveryPreferences(
  uid: string,
  prefs: {
    minAge: number;
    maxAge: number;
    maxDistanceKm: number;
    showMe: boolean;
    interestedIn?: Gender[];
    strictAgeBoundary?: boolean;
    strictDistanceBoundary?: boolean;
  }
): Promise<void> {
  const minAge = Math.max(VOLUMETRIC_LIMITS.MIN_AGE, Math.min(VOLUMETRIC_LIMITS.MAX_AGE, Math.round(prefs.minAge)));
  const maxAge = Math.max(minAge, Math.min(VOLUMETRIC_LIMITS.MAX_AGE, Math.round(prefs.maxAge)));
  const maxDistanceKm = Math.max(
    VOLUMETRIC_LIMITS.MIN_DISTANCE_KM,
    Math.min(VOLUMETRIC_LIMITS.MAX_DISTANCE_KM, Math.round(prefs.maxDistanceKm))
  );

  try {
    const batch = writeBatch(db);
    const privatePatch: Record<string, unknown> = {
      minAge,
      maxAge,
      maxDistanceKm,
      showMe: prefs.showMe,
      updatedAt: serverTimestamp(),
    };
    if (typeof prefs.strictAgeBoundary === 'boolean') {
      privatePatch.strictAgeBoundary = prefs.strictAgeBoundary;
    }
    if (typeof prefs.strictDistanceBoundary === 'boolean') {
      privatePatch.strictDistanceBoundary = prefs.strictDistanceBoundary;
    }

    batch.update(doc(db, 'profiles', uid, 'private', 'info'), privatePatch);
    const profilePatch: Record<string, unknown> = {
      isVisible: prefs.showMe,
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (prefs.interestedIn && prefs.interestedIn.length > 0) {
      profilePatch.interestedIn = prefs.interestedIn.slice(0, 4);
    }
    batch.update(doc(db, 'profiles', uid), profilePatch);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `profiles/${uid}/private/info`);
  }
}

export async function submitProfileIdentityVerification(params: {
  uid: string;
  fullName: string;
  docType: VerificationDocType;
  last4: string;
  verifiedDob?: string;
  alreadySelfieVerified: boolean;
  alreadyHasFirstVerifiedAt: boolean;
}): Promise<void> {
  const cleanName = clampString(params.fullName, 80);
  const cleanLast4 = params.last4.trim().slice(0, 4).toUpperCase();
  const cleanDob = params.verifiedDob?.trim();
  const computedAge = cleanDob ? ageFromDob(cleanDob) : null;

  try {
    const batch = writeBatch(db);
    const profilePatch: Record<string, unknown> = {
      isProfileVerified: true,
      lastVerifiedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (computedAge !== null && computedAge >= 18 && computedAge <= 99) {
      profilePatch.age = computedAge;
    }
    if (params.alreadySelfieVerified) {
      profilePatch.securityCheckPending = false;
      profilePatch.photoVerificationRequired = false;
    }
    batch.update(doc(db, 'profiles', params.uid), profilePatch);

    const privatePatch: Record<string, unknown> = {
      verificationFullName: cleanName,
      verificationDocType: params.docType,
      verificationLast4: cleanLast4,
      updatedAt: serverTimestamp(),
    };
    if (cleanDob && computedAge !== null && computedAge >= 18 && computedAge <= 99) {
      privatePatch.dob = cleanDob;
    }
    if (params.alreadySelfieVerified && !params.alreadyHasFirstVerifiedAt) {
      privatePatch.firstVerifiedAt = serverTimestamp();
      privatePatch.lastSecurityCheckAt = serverTimestamp();
    }
    batch.update(doc(db, 'profiles', params.uid, 'private', 'info'), privatePatch);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `profiles/${params.uid}`);
  }
}

export async function submitSelfieVerification(params: {
  uid: string;
  alreadyProfileVerified: boolean;
  alreadyHasFirstVerifiedAt: boolean;
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    const profilePatch: Record<string, unknown> = {
      isSelfieVerified: true,
      lastVerifiedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.alreadyProfileVerified) {
      profilePatch.securityCheckPending = false;
      profilePatch.photoVerificationRequired = false;
    }
    batch.update(doc(db, 'profiles', params.uid), profilePatch);

    const privatePatch: Record<string, unknown> = {
      lastSecurityCheckAt: serverTimestamp(),
      chatsSinceSecurityCheck: 0,
      updatedAt: serverTimestamp(),
    };
    if (params.alreadyProfileVerified && !params.alreadyHasFirstVerifiedAt) {
      privatePatch.firstVerifiedAt = serverTimestamp();
    }
    batch.update(doc(db, 'profiles', params.uid, 'private', 'info'), privatePatch);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `profiles/${params.uid}`);
  }
}

export async function flagPeriodicSecurityCheck(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'profiles', uid), {
      securityCheckPending: true,
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `profiles/${uid}`);
  }
}

export async function recordChatOpenedForSecurityAudit(
  uid: string,
  nextCount: number
): Promise<void> {
  try {
    await updateDoc(doc(db, 'profiles', uid, 'private', 'info'), {
      chatsSinceSecurityCheck: Math.max(0, Math.min(100_000, Math.round(nextCount))),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `profiles/${uid}/private/info`);
  }
}

export async function saveRealLifeCheckInInterests(
  uid: string,
  interestsToBoost: string[]
): Promise<void> {
  const clean = interestsToBoost
    .map((tag) => clampString(tag, VOLUMETRIC_LIMITS.MAX_INTEREST_LEN))
    .filter(Boolean)
    .slice(0, 16);
  try {
    await updateDoc(doc(db, 'profiles', uid, 'private', 'info'), {
      preferredInterests: clean,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `profiles/${uid}/private/info`);
  }
}

export async function deactivateAccount(uid: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'profiles', uid), {
      isDeleted: true,
      isVisible: false,
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.delete(doc(db, 'profiles', uid, 'private', 'info'));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `profiles/${uid}`);
  }
}

export async function recordSwipe(params: {
  viewer: PublicProfile;
  ranked: RankedCandidate;
  action: SwipeAction;
  existingMatchIds: Set<string>;
  note?: string;
}): Promise<SwipeResult> {
  const { viewer, ranked, action, existingMatchIds, note } = params;
  const candidate = ranked.profile;
  const swipeId = buildCompositeId(viewer.uid, candidate.uid);
  const swipeRef = doc(db, 'swipes', swipeId);
  const cleanNote = note ? clampString(note, VOLUMETRIC_LIMITS.MAX_SWIPE_NOTE_LEN) : '';

  const swipePayload: Record<string, unknown> = {
    actorId: viewer.uid,
    targetId: candidate.uid,
    action,
    createdAt: serverTimestamp(),
  };
  if (cleanNote) {
    swipePayload.note = cleanNote;
  }

  try {
    await setDoc(swipeRef, swipePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `swipes/${swipeId}`);
  }

  if (action === 'pass') {
    return { matched: false, swipeId };
  }

  // Handle curated sample profiles with owner-scoped Firestore persistence
  if (candidate.uid.startsWith('demo_')) {
    if (!shouldDemoReciprocate(candidate.uid, action)) {
      return { matched: false, swipeId };
    }
    const demoRef = doc(db, 'profiles', viewer.uid, 'demoMatches', candidate.uid);
    const greeting = buildDemoGreeting(candidate.displayName, ranked.breakdown.sharedInterests);
    const initialMessages: DemoMessage[] = [
      {
        id: `demo_msg_${Date.now()}`,
        senderId: candidate.uid,
        body: greeting,
        sentAtIso: new Date().toISOString(),
      },
    ];
    try {
      await setDoc(demoRef, {
        ownerId: viewer.uid,
        demoId: candidate.uid,
        profileName: clampString(candidate.displayName, 40),
        profileAge: candidate.age,
        profileCity: clampString(candidate.city, 80),
        profileJobTitle: clampString(candidate.jobTitle, 80),
        profilePhoto: (candidate.photos[0] || '').slice(0, VOLUMETRIC_LIMITS.MAX_PHOTO_URL_LEN),
        compatibilityScore: ranked.breakdown.total,
        matchReasons: ranked.breakdown.reasons.slice(0, 6),
        messages: initialMessages,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `profiles/${viewer.uid}/demoMatches/${candidate.uid}`);
    }

    const conversation: UnifiedConversation = {
      kind: 'demo',
      id: candidate.uid,
      partnerUid: candidate.uid,
      partnerName: candidate.displayName,
      partnerAge: candidate.age,
      partnerPhoto: candidate.photos[0] ?? '',
      partnerCity: candidate.city,
      partnerJobTitle: candidate.jobTitle,
      compatibilityScore: ranked.breakdown.total,
      matchReasons: ranked.breakdown.reasons,
      lastMessageText: greeting,
      lastMessageAt: new Date(),
      lastMessageSenderId: candidate.uid,
      matchedAt: new Date(),
      unreadCount: 1,
      demoMessages: initialMessages,
    };

    return { matched: true, swipeId, conversation };
  }

  // Real Firestore user reciprocal match check
  const reciprocalId = buildCompositeId(candidate.uid, viewer.uid);
  let reciprocalSnap;
  try {
    reciprocalSnap = await getDoc(doc(db, 'swipes', reciprocalId));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `swipes/${reciprocalId}`);
  }

  if (!reciprocalSnap.exists()) {
    return { matched: false, swipeId };
  }

  const reciprocalAction = reciprocalSnap.data().action as SwipeAction;
  if (reciprocalAction !== 'like' && reciprocalAction !== 'superlike') {
    return { matched: false, swipeId };
  }

  const [userLow, userHigh] = orderedPair(viewer.uid, candidate.uid);
  const matchId = buildMatchId(viewer.uid, candidate.uid);

  const summaryFor = (p: PublicProfile): ParticipantSummary => ({
    uid: p.uid,
    displayName: clampString(p.displayName, 40) || 'Member',
    age: Math.max(18, Math.min(99, Math.round(p.age))),
    photo: (p.photos[0] || PORTRAIT_PRESETS[0].url).slice(0, VOLUMETRIC_LIMITS.MAX_PHOTO_URL_LEN),
    city: clampString(p.city, 80),
    jobTitle: clampString(p.jobTitle, 80),
  });

  if (!existingMatchIds.has(matchId)) {
    try {
      await setDoc(doc(db, 'matches', matchId), {
        userLow,
        userHigh,
        participants: [userLow, userHigh],
        participantSummaries: {
          [viewer.uid]: summaryFor(viewer),
          [candidate.uid]: summaryFor(candidate),
        },
        compatibilityScore: ranked.breakdown.total,
        matchReasons: ranked.breakdown.reasons.slice(0, 6),
        isActive: true,
        matchedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `matches/${matchId}`);
    }
  }

  const conversation: UnifiedConversation = {
    kind: 'live',
    id: matchId,
    partnerUid: candidate.uid,
    partnerName: candidate.displayName,
    partnerAge: candidate.age,
    partnerPhoto: candidate.photos[0] ?? '',
    partnerCity: candidate.city,
    partnerJobTitle: candidate.jobTitle,
    compatibilityScore: ranked.breakdown.total,
    matchReasons: ranked.breakdown.reasons,
    lastMessageText: '',
    lastMessageAt: new Date(),
    matchedAt: new Date(),
    unreadCount: 0,
  };

  return { matched: true, swipeId, conversation };
}

export async function undoSwipe(swipeId: string): Promise<void> {
  const path = `swipes/${swipeId}`;
  try {
    await deleteDoc(doc(db, 'swipes', swipeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function sendLiveMessage(params: {
  matchId: string;
  senderId: string;
  recipientId: string;
  body: string;
  clientId?: string;
  voiceNote?: EncryptedVoicePayload;
}): Promise<void> {
  const voice = params.voiceNote;
  const cleanBody = voice
    ? clampString(buildVoiceMessageSummary(voice.durationSec), 500)
    : clampString(params.body, VOLUMETRIC_LIMITS.MAX_MESSAGE_LEN);
  if (!cleanBody) return;

  const msgRef = doc(collection(db, 'matches', params.matchId, 'messages'));
  const matchRef = doc(db, 'matches', params.matchId);
  const clientId = params.clientId ?? generateClientId();

  const messageDoc: Record<string, unknown> = {
    matchId: params.matchId,
    senderId: params.senderId,
    recipientId: params.recipientId,
    body: cleanBody,
    clientId,
    sentAt: serverTimestamp(),
  };

  if (voice) {
    messageDoc.kind = 'voice';
    messageDoc.voiceCiphertext = voice.ciphertextBase64;
    messageDoc.voiceIv = voice.ivBase64;
    messageDoc.voiceMimeType = voice.mimeType;
    messageDoc.voiceDurationSec = voice.durationSec;
  }

  try {
    const batch = writeBatch(db);
    batch.set(msgRef, messageDoc);
    batch.update(matchRef, {
      lastMessageText: cleanBody.slice(0, 500),
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: params.senderId,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `matches/${params.matchId}/messages`);
  }
}

export async function markLiveMessagesRead(
  matchId: string,
  messageIds: string[]
): Promise<void> {
  if (messageIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const id of messageIds.slice(0, 40)) {
      batch.update(doc(db, 'matches', matchId, 'messages', id), {
        readAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `matches/${matchId}/messages`);
  }
}

export async function sendDemoMessage(params: {
  ownerId: string;
  demoMatch: DemoMatchRecord;
  body: string;
  sharedInterests: string[];
  clientId?: string;
  voiceNote?: EncryptedVoicePayload;
}): Promise<void> {
  const voice = params.voiceNote;
  const cleanBody = voice
    ? clampString(buildVoiceMessageSummary(voice.durationSec), 500)
    : clampString(params.body, VOLUMETRIC_LIMITS.MAX_MESSAGE_LEN);
  if (!cleanBody) return;

  const userMsg: DemoMessage = {
    id: params.clientId ?? generateClientId(),
    senderId: params.ownerId,
    body: cleanBody,
    sentAtIso: new Date().toISOString(),
    readAtIso: new Date().toISOString(),
    ...(voice
      ? {
          kind: 'voice' as const,
          voiceCiphertext: voice.ciphertextBase64,
          voiceIv: voice.ivBase64,
          voiceMimeType: voice.mimeType,
          voiceDurationSec: voice.durationSec,
        }
      : {}),
  };

  const replyText = buildDemoReply(
    params.demoMatch.profileName,
    cleanBody,
    params.sharedInterests,
    Boolean(voice)
  );
  const replyMsg: DemoMessage = {
    id: `${generateClientId()}_r`,
    senderId: params.demoMatch.demoId,
    body: replyText,
    sentAtIso: new Date(Date.now() + 500).toISOString(),
  };

  const updatedMessages = [...params.demoMatch.messages, userMsg, replyMsg].slice(-100);
  const path = `profiles/${params.ownerId}/demoMatches/${params.demoMatch.demoId}`;

  try {
    await updateDoc(doc(db, 'profiles', params.ownerId, 'demoMatches', params.demoMatch.demoId), {
      messages: updatedMessages,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markDemoMessagesRead(
  ownerId: string,
  demoMatch: DemoMatchRecord
): Promise<void> {
  const hasUnread = demoMatch.messages.some(
    (m) => m.senderId !== ownerId && !m.readAtIso
  );
  if (!hasUnread) return;
  const nowIso = new Date().toISOString();
  const nextMessages = demoMatch.messages.map((m) =>
    m.senderId !== ownerId && !m.readAtIso ? { ...m, readAtIso: nowIso } : m
  );
  try {
    await updateDoc(doc(db, 'profiles', ownerId, 'demoMatches', demoMatch.demoId), {
      messages: nextMessages,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `profiles/${ownerId}/demoMatches/${demoMatch.demoId}`);
  }
}

export async function sendDemoSafetyCheck(
  ownerId: string,
  demoMatch: DemoMatchRecord
): Promise<void> {
  if (demoMatch.messages.some((m) => m.id === SAFETY_CHECK_MESSAGE_ID)) {
    return;
  }

  const checkAt = getSafetyCheckAt(demoMatch.createdAt);
  const safetyMsg: DemoMessage = {
    id: SAFETY_CHECK_MESSAGE_ID,
    senderId: SAFETY_CHECK_SENDER_ID,
    body: buildSafetyCheckBody(demoMatch.profileName),
    sentAtIso: checkAt.toISOString(),
  };

  const nextMessages = [...demoMatch.messages, safetyMsg]
    .sort((a, b) => new Date(a.sentAtIso).getTime() - new Date(b.sentAtIso).getTime())
    .slice(-100);

  const path = `profiles/${ownerId}/demoMatches/${demoMatch.demoId}`;
  try {
    await updateDoc(doc(db, 'profiles', ownerId, 'demoMatches', demoMatch.demoId), {
      messages: nextMessages,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function unmatchConversation(params: {
  viewerUid: string;
  kind: 'live' | 'demo';
  conversationId: string;
}): Promise<void> {
  if (params.kind === 'demo') {
    const path = `profiles/${params.viewerUid}/demoMatches/${params.conversationId}`;
    try {
      await updateDoc(doc(db, 'profiles', params.viewerUid, 'demoMatches', params.conversationId), {
        isActive: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return;
  }

  const path = `matches/${params.conversationId}`;
  try {
    await updateDoc(doc(db, 'matches', params.conversationId), {
      isActive: false,
      closedBy: params.viewerUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function blockUser(params: {
  blockerId: string;
  blockedId: string;
  blockedName: string;
  activeLiveMatchId?: string;
  activeDemoMatchId?: string;
}): Promise<void> {
  if (!params.blockerId || !params.blockedId || params.blockerId === params.blockedId) {
    throw new Error('Cannot block this account.');
  }
  const blockId = buildCompositeId(params.blockerId, params.blockedId);
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'blocks', blockId), {
      blockerId: params.blockerId,
      blockedId: params.blockedId,
      blockedName: clampString(params.blockedName, 60) || 'Member',
      createdAt: serverTimestamp(),
    });
    if (params.activeLiveMatchId) {
      batch.update(doc(db, 'matches', params.activeLiveMatchId), {
        isActive: false,
        closedBy: params.blockerId,
        updatedAt: serverTimestamp(),
      });
    }
    if (params.activeDemoMatchId) {
      batch.update(doc(db, 'profiles', params.blockerId, 'demoMatches', params.activeDemoMatchId), {
        isActive: false,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `blocks/${blockId}`);
  }
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const blockId = buildCompositeId(blockerId, blockedId);
  try {
    await deleteDoc(doc(db, 'blocks', blockId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `blocks/${blockId}`);
  }
}

export async function submitReport(params: {
  reporterId: string;
  reportedId: string;
  reason: ReportReason;
  details: string;
}): Promise<void> {
  try {
    await addDoc(collection(db, 'reports'), {
      reporterId: params.reporterId,
      reportedId: params.reportedId,
      reason: params.reason,
      details: clampString(params.details, VOLUMETRIC_LIMITS.MAX_REPORT_DETAILS_LEN),
      status: 'open',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'reports');
  }
}
