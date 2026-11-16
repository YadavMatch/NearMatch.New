export const SAFETY_CHECK_DELAY_MS = 24 * 60 * 60 * 1000;
export const SAFETY_CHECK_MESSAGE_ID = 'safety_check_24h';
export const SAFETY_CHECK_SENDER_ID = 'nearmatch_safety';

export interface MatchTimingRef {
  id: string;
  matchedAt: Date;
}

export function findFirstMatch<T extends MatchTimingRef>(matches: T[]): T | null {
  if (matches.length === 0) return null;
  let earliest = matches[0];
  for (let i = 1; i < matches.length; i += 1) {
    const candidate = matches[i];
    const diff = candidate.matchedAt.getTime() - earliest.matchedAt.getTime();
    if (diff < 0 || (diff === 0 && candidate.id < earliest.id)) {
      earliest = candidate;
    }
  }
  return earliest;
}

export function getSafetyCheckAt(matchedAt: Date): Date {
  return new Date(matchedAt.getTime() + SAFETY_CHECK_DELAY_MS);
}

export function isSafetyCheckDue(matchedAt: Date, nowMs: number = Date.now()): boolean {
  return nowMs >= getSafetyCheckAt(matchedAt).getTime();
}

export function buildSafetyCheckBody(partnerName: string): string {
  const firstName = partnerName.trim().split(/\s+/)[0] || 'your match';
  return (
    `Safety Check — You and ${firstName} matched 24 hours ago. ` +
    `Take things at a comfortable pace. If anything ever feels off, you can use the Report or Block buttons at the top of this chat, or review our Safety Guidelines before meeting in person.`
  );
}
