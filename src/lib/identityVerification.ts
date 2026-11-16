import type { PrivateAccount, PublicProfile, VerificationDocType } from '../types/models.ts';
import { ageFromDob } from './matching.ts';

export interface VerificationStateSummary {
  isProfileVerified: boolean;
  isSelfieVerified: boolean;
  isFirstTimeVerified: boolean;
  securityCheckPending: boolean;
  photoVerificationRequired: boolean;
  needsVerificationToChat: boolean;
  reason: 'none' | 'first_time' | 'security_check' | 'photo_change';
}

export const LIVENESS_CHALLENGES: readonly string[] = [
  'Center your face inside the frame with even daylight',
  'Offer a gentle natural smile for the live camera check',
  'Keep both eyes open and look directly toward the lens',
];

export function getVerificationStatus(
  profile: Pick<
    PublicProfile,
    'isProfileVerified' | 'isSelfieVerified' | 'securityCheckPending' | 'photoVerificationRequired'
  > | null | undefined,
  privateAccount?: Pick<PrivateAccount, 'firstVerifiedAt'> | null
): VerificationStateSummary {
  const isProfileVerified = Boolean(profile?.isProfileVerified);
  const isSelfieVerified = Boolean(profile?.isSelfieVerified);
  const photoVerificationRequired = Boolean(profile?.photoVerificationRequired);
  const isFirstTimeVerified =
    isProfileVerified &&
    isSelfieVerified &&
    (privateAccount === undefined || Boolean(privateAccount?.firstVerifiedAt) || (isProfileVerified && isSelfieVerified));

  const securityCheckPending = Boolean(profile?.securityCheckPending);

  if (photoVerificationRequired) {
    return {
      isProfileVerified,
      isSelfieVerified,
      isFirstTimeVerified,
      securityCheckPending: true,
      photoVerificationRequired: true,
      needsVerificationToChat: true,
      reason: 'photo_change',
    };
  }

  if (!isFirstTimeVerified) {
    return {
      isProfileVerified,
      isSelfieVerified,
      isFirstTimeVerified: false,
      securityCheckPending,
      photoVerificationRequired: false,
      needsVerificationToChat: true,
      reason: 'first_time',
    };
  }

  if (securityCheckPending) {
    return {
      isProfileVerified,
      isSelfieVerified,
      isFirstTimeVerified: true,
      securityCheckPending: true,
      photoVerificationRequired: false,
      needsVerificationToChat: true,
      reason: 'security_check',
    };
  }

  return {
    isProfileVerified,
    isSelfieVerified,
    isFirstTimeVerified: true,
    securityCheckPending: false,
    photoVerificationRequired: false,
    needsVerificationToChat: false,
    reason: 'none',
  };
}

export function validateIdentitySubmission(input: {
  fullName: string;
  docType: VerificationDocType;
  last4: string;
  dob?: string;
  attested: boolean;
}): string | null {
  const cleanName = input.fullName.trim();
  if (cleanName.length < 3 || cleanName.length > 80) {
    return 'Enter your full legal name as shown on your ID (3–80 characters).';
  }
  if (!['passport', 'national_id', 'drivers_license'].includes(input.docType)) {
    return 'Select a valid identity document type.';
  }
  if (!/^[a-zA-Z0-9]{4}$/.test(input.last4.trim())) {
    return 'Enter the last 4 alphanumeric characters of your document.';
  }
  if (input.dob !== undefined) {
    const computed = ageFromDob(input.dob.trim());
    if (computed === null || computed < 18 || computed > 99) {
      return 'Age verification requires a valid date of birth confirming you are 18 or older.';
    }
  }
  if (!input.attested) {
    return 'Confirm that your real identity and age match your profile and uploaded photos.';
  }
  return null;
}

/**
 * Determines whether a periodic random security re-check should be triggered
 * after a member has already completed their initial Real Identity + Selfie verification.
 */
export function shouldTriggerPeriodicSecurityCheck(params: {
  isFirstTimeVerified: boolean;
  securityCheckPending: boolean;
  chatsSinceSecurityCheck: number;
  lastSecurityCheckAt?: Date;
  nowMs?: number;
  randomRoll?: number;
}): boolean {
  if (!params.isFirstTimeVerified) return false;
  if (params.securityCheckPending) return false;

  const nowMs = params.nowMs ?? Date.now();
  const minCooldownMs = 6 * 3_600_000; // Do not re-trigger within 6 hours of last check
  if (
    params.lastSecurityCheckAt &&
    nowMs - params.lastSecurityCheckAt.getTime() < minCooldownMs
  ) {
    return false;
  }

  // Deterministic safeguard after 4+ newly opened conversations OR ~20% random spot check
  if (params.chatsSinceSecurityCheck >= 4) {
    return true;
  }

  const roll = params.randomRoll ?? Math.random();
  return params.chatsSinceSecurityCheck >= 1 && roll < 0.2;
}
