import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { DELETED_ACCOUNT_LABEL, ERASED_PARTICIPANT_SUMMARY, isErasedSummary } from '../accountErasure.ts';

const rootDir = path.resolve(import.meta.dirname, '../../..');
const rulesText = fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8');

const liveSummary: { uid: string; displayName: string; age: number; photo: string; city: string; jobTitle: string } = {
  uid: 'u1',
  displayName: 'Diya Nair',
  age: 26,
  photo: 'https://example.test/a.jpg',
  city: 'Mumbai',
  jobTitle: 'Designer',
};

test('isErasedSummary recognises a blanked summary and nothing else', () => {
  const erased = { uid: 'u1', ...ERASED_PARTICIPANT_SUMMARY };
  assert.equal(isErasedSummary(erased), true);
  assert.equal(isErasedSummary(liveSummary), false);
  assert.equal(isErasedSummary(undefined), false);
  assert.equal(isErasedSummary(null), false);
});

test('isErasedSummary does not treat a merely nameless summary as erased', () => {
  // age is the marker; a live summary can never be 0, so a blank name alone
  // must not blank out a real person's card.
  assert.equal(isErasedSummary({ ...liveSummary, displayName: '' }), false);
  assert.equal(isErasedSummary({ ...liveSummary, age: 0 }), false);
});

test('the erased summary carries no human-readable field', () => {
  const values = Object.values(ERASED_PARTICIPANT_SUMMARY);
  assert.ok(values.includes(0), 'age must be the 0 marker');
  for (const value of values) {
    assert.ok(value === '' || value === 0, `unexpected residue in erased summary: ${String(value)}`);
  }
  assert.equal(ERASED_PARTICIPANT_SUMMARY.displayName, '');
  assert.equal(ERASED_PARTICIPANT_SUMMARY.photo, '');
});

test('the deleted-account label is presentation only and never stored', () => {
  const stored = JSON.stringify(ERASED_PARTICIPANT_SUMMARY);
  assert.ok(!stored.includes(DELETED_ACCOUNT_LABEL));
});

test('firestore.rules lets an owner delete their own profile document', () => {
  assert.match(rulesText, /allow delete: if isOwner\(userId\) && isValidId\(userId\);/);
  const profileIdx = rulesText.indexOf('match /profiles/{userId}');
  const privateIdx = rulesText.indexOf('match /private/{docId}');
  const deleteIdx = rulesText.indexOf('allow delete: if isOwner(userId) && isValidId(userId);');
  assert.ok(deleteIdx > profileIdx && deleteIdx < privateIdx, 'profile delete must sit on the profile document rule');
});

test('firestore.rules still refuses to delete matches, messages and reports', () => {
  const matchesIdx = rulesText.indexOf('match /matches/{matchId}');
  const messagesIdx = rulesText.indexOf('match /messages/{messageId}');
  const reportsIdx = rulesText.indexOf('match /reports/{reportId}');
  assert.ok(matchesIdx > 0 && messagesIdx > matchesIdx && reportsIdx > messagesIdx);
  assert.match(rulesText.slice(reportsIdx), /allow update, delete: if false;/);
  // Two `allow delete: if false` remain between the matches block and reports:
  // one for the match document, one for its messages.
  const between = rulesText.slice(matchesIdx, reportsIdx);
  assert.equal((between.match(/allow delete: if false;/g) ?? []).length, 2);
});

test('swipe erasure is gated on the profile already being gone', () => {
  assert.match(
    rulesText,
    /!exists\(\/databases\/\$\(database\)\/documents\/profiles\/\$\(uid\(\)\)\)/,
    'the broad swipe delete must require the actor profile to be absent'
  );
});
