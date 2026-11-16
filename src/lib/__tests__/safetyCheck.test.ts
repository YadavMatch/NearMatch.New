import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSafetyCheckBody,
  findFirstMatch,
  getSafetyCheckAt,
  isSafetyCheckDue,
  SAFETY_CHECK_DELAY_MS,
} from '../safetyCheck.ts';

test('findFirstMatch picks the earliest matched conversation deterministically', () => {
  const m1 = { id: 'b_second', matchedAt: new Date('2026-11-10T10:00:00Z') };
  const m2 = { id: 'a_first', matchedAt: new Date('2026-11-09T09:00:00Z') };
  const m3 = { id: 'c_latest', matchedAt: new Date('2026-11-12T15:00:00Z') };

  assert.equal(findFirstMatch([]), null);
  assert.equal(findFirstMatch([m1, m2, m3])?.id, 'a_first');
});

test('isSafetyCheckDue triggers strictly at and after 24 hours from matchedAt', () => {
  const matchedAt = new Date('2026-11-10T12:00:00Z');
  const expectedCheckAt = getSafetyCheckAt(matchedAt);
  assert.equal(expectedCheckAt.getTime(), matchedAt.getTime() + SAFETY_CHECK_DELAY_MS);

  assert.equal(isSafetyCheckDue(matchedAt, expectedCheckAt.getTime() - 1), false);
  assert.equal(isSafetyCheckDue(matchedAt, expectedCheckAt.getTime()), true);
  assert.equal(isSafetyCheckDue(matchedAt, expectedCheckAt.getTime() + 60_000), true);
});

test('buildSafetyCheckBody includes first name and reporting/safety reminder', () => {
  const body = buildSafetyCheckBody('Diya Nair');
  assert.match(body, /Diya/);
  assert.match(body, /24 hours ago/);
  assert.match(body, /Report/);
  assert.match(body, /Safety Guidelines/);
});
