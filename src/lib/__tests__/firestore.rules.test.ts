import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rootDir = path.resolve(import.meta.dirname, '../../..');
const rulesText = fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8');
const blueprint = JSON.parse(fs.readFileSync(path.join(rootDir, 'firebase-blueprint.json'), 'utf8'));
const specText = fs.readFileSync(path.join(rootDir, 'security_spec.md'), 'utf8');

test('firestore.rules enforces rules_version 2 and default-deny catch-all at top', () => {
  assert.match(rulesText, /^rules_version = '2';/);
  const catchAllIdx = rulesText.indexOf('match /{document=**}');
  const firstCollectionIdx = rulesText.indexOf('match /profiles/{userId}');
  assert.ok(catchAllIdx > 0 && catchAllIdx < firstCollectionIdx, 'Default-deny catch-all must precede all collection rules');
  assert.match(rulesText, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
});

test('every collection path in firebase-blueprint.json is secured in firestore.rules', () => {
  const paths = Object.keys(blueprint.firestore);
  assert.ok(paths.length >= 8);
  assert.match(rulesText, /match \/profiles\/\{userId\}/);
  assert.match(rulesText, /match \/private\/\{docId\}/);
  assert.match(rulesText, /match \/demoMatches\/\{demoId\}/);
  assert.match(rulesText, /match \/swipes\/\{swipeId\}/);
  assert.match(rulesText, /match \/matches\/\{matchId\}/);
  assert.match(rulesText, /match \/messages\/\{messageId\}/);
  assert.match(rulesText, /match \/blocks\/\{blockId\}/);
  assert.match(rulesText, /match \/reports\/\{reportId\}/);
  assert.match(rulesText, /match \/test\/\{docId\}/);
});

test('Dirty Dozen security invariants are encoded in firestore.rules and documented in security_spec.md', () => {
  // 1. Verified email gate
  assert.match(rulesText, /request\.auth\.token\.email_verified == true/);
  // 2. PII isolation on /private/info
  assert.match(rulesText, /match \/private\/\{docId\}[\s\S]*allow get: if isOwner\(userId\)/);
  assert.match(rulesText, /match \/private\/\{docId\}[\s\S]*allow list: if false;/);
  // 3. Adult 18+ floor & ban tamper protection
  assert.match(rulesText, /data\.age is int && data\.age >= 18 && data\.age <= 99/);
  assert.match(rulesText, /data\.isBanned == false/);
  assert.match(rulesText, /existing\(\)\.isBanned == false/);
  // 4. Hidden incoming likes (swipes list restricted to actorId == uid())
  assert.match(rulesText, /allow list: if isVerified\(\) && resource\.data\.actorId == uid\(\);/);
  // 5. Atomic reciprocal match enforcement via getAfter
  assert.match(rulesText, /existsAfter\(\/databases\/\$\(database\)\/documents\/swipes\//);
  assert.match(rulesText, /getAfter\(\/databases\/\$\(database\)\/documents\/swipes\//);
  // 6. Master Gate + Terminal State Locking on messages & matches
  assert.match(rulesText, /existing\(\)\.isActive == true/);
  assert.match(rulesText, /incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(\['readAt'\]\)/);
  // 7. Block enforcement across swipes, matches, and messages
  assert.match(rulesText, /!isBlockedPair\(/);
  // 8. All 12 Dirty Dozen scenarios documented
  for (let i = 1; i <= 12; i += 1) {
    assert.ok(specText.includes(`${i}. **`), `Missing Dirty Dozen item ${i} in security_spec.md`);
  }
});
