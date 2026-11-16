import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COOKIE_NOTICE_COPY,
  createAcceptAllConsent,
  createEssentialOnlyConsent,
  parseStoredConsent,
  summarizeConsentStatus,
} from '../cookieConsent.ts';

test('COOKIE_NOTICE_COPY contains the exact disclosure copy', () => {
  assert.equal(
    COOKIE_NOTICE_COPY,
    'We and our partners use tools to measure the audience of our website, provide you with offers and advertising tailored to your interests, and to enable interactive social platform features such as share buttons.'
  );
});

test('parseStoredConsent validates persisted payloads and rejects malformed JSON', () => {
  const accepted = createAcceptAllConsent(new Date('2026-11-15T06:00:00.000Z'));
  const parsed = parseStoredConsent(JSON.stringify(accepted));
  assert.deepEqual(parsed, accepted);

  assert.equal(parseStoredConsent(null), null);
  assert.equal(parseStoredConsent('not-json'), null);
  assert.equal(parseStoredConsent(JSON.stringify({ necessary: false })), null);
  assert.equal(
    parseStoredConsent(JSON.stringify({ necessary: true, analytics: 'yes' })),
    null
  );
});

test('summarizeConsentStatus formats all, essential, custom, and unset states cleanly', () => {
  const now = new Date('2026-11-15T06:00:00.000Z');
  assert.equal(summarizeConsentStatus(null), 'Not configured');
  assert.equal(summarizeConsentStatus(createAcceptAllConsent(now)), 'All cookies accepted');
  assert.equal(
    summarizeConsentStatus(createEssentialOnlyConsent(now)),
    'Essential cookies only'
  );
  assert.equal(
    summarizeConsentStatus({
      necessary: true,
      analytics: true,
      advertising: false,
      social: true,
      updatedAt: now.toISOString(),
    }),
    'Custom preferences'
  );
});
