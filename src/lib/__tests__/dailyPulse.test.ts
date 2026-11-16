import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DAILY_PULSE_QUOTES,
  getDailyPulseQuote,
  getLocalDateKey,
} from '../dailyPulse.ts';

test('getDailyPulseQuote returns consistent quote within the same local calendar day', () => {
  const morning = new Date(2026, 10, 15, 8, 15, 0);
  const evening = new Date(2026, 10, 15, 22, 45, 0);

  const first = getDailyPulseQuote(morning);
  const second = getDailyPulseQuote(evening);

  assert.equal(getLocalDateKey(morning), '2026-11-15');
  assert.equal(first.id, second.id);
  assert.equal(first.quote, second.quote);
});

test('getDailyPulseQuote rotates sequentially across consecutive days and wraps cleanly', () => {
  const dayOne = new Date(2026, 10, 15, 12, 0, 0);
  const dayTwo = new Date(2026, 10, 16, 12, 0, 0);
  const fullCycleLater = new Date(
    2026,
    10,
    15 + DAILY_PULSE_QUOTES.length,
    12,
    0,
    0
  );

  const q1 = getDailyPulseQuote(dayOne);
  const q2 = getDailyPulseQuote(dayTwo);
  const qWrap = getDailyPulseQuote(fullCycleLater);

  assert.notEqual(q1.id, q2.id);
  assert.equal(q1.id, qWrap.id);
});

test('all DAILY_PULSE_QUOTES contain non-empty quote, theme, and reflection', () => {
  const seenIds = new Set<string>();
  for (const item of DAILY_PULSE_QUOTES) {
    assert.ok(item.id.length > 0);
    assert.ok(!seenIds.has(item.id), `Duplicate pulse id: ${item.id}`);
    seenIds.add(item.id);
    assert.ok(item.quote.trim().length > 20);
    assert.ok(item.theme.trim().length > 0);
    assert.ok(item.reflection.trim().length > 10);
  }
});
