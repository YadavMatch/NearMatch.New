export function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function orderedPair(uidA: string, uidB: string): [string, string] {
  return uidA < uidB ? [uidA, uidB] : [uidB, uidA];
}

export function buildCompositeId(a: string, b: string): string {
  return `${a}_${b}`;
}

export function buildMatchId(uidA: string, uidB: string): string {
  const [low, high] = orderedPair(uidA, uidB);
  return `${low}_${high}`;
}

export function generateClientId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `msg_${Date.now().toString(36)}_${rand}`;
}

export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDayLabel(date: Date): string {
  const now = new Date();
  if (isSameCalendarDay(date, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameCalendarDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function isValidImageSrc(src: string): boolean {
  if (!src) return false;
  if (src.startsWith('/') || src.startsWith('data:image/')) return true;
  try {
    const parsed = new URL(src);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
