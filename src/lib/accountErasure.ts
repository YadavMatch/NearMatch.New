/**
 * Pure helpers for the account-erasure path.
 *
 * Kept free of any Firebase import so it can be unit tested without a
 * Firebase config, matching how blocking.ts and matching.ts are structured.
 */

/** The shape a participant summary is left in once its owner erases their account. */
export const ERASED_PARTICIPANT_SUMMARY = {
  displayName: '',
  age: 0,
  photo: '',
  city: '',
  jobTitle: '',
} as const;

/** Shown in place of a name whose owner has erased their account. */
export const DELETED_ACCOUNT_LABEL = 'Deleted account';

/**
 * True when a match's participant summary has been blanked by erasure.
 * age 0 is the marker: a live summary is always between 18 and 99, so a
 * merely nameless summary is not mistaken for a deleted one.
 */
export function isErasedSummary(
  summary?: { age?: number; displayName?: string } | null
): boolean {
  return Boolean(summary) && summary?.age === 0 && summary?.displayName === '';
}

export interface AccountErasureReport {
  matchesScrubbed: number;
  swipesDeleted: number;
  blocksDeleted: number;
  demoMatchesDeleted: number;
  profileDeleted: boolean;
  privateRecordDeleted: boolean;
}
