import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getVerificationStatus,
  shouldTriggerPeriodicSecurityCheck,
  validateIdentitySubmission,
} from '../identityVerification.ts';

test('getVerificationStatus gates first-time chat until both profile and selfie verification pass', () => {
  const unverified = getVerificationStatus({
    isProfileVerified: false,
    isSelfieVerified: false,
    securityCheckPending: false,
  });
  assert.equal(unverified.isFirstTimeVerified, false);
  assert.equal(unverified.needsVerificationToChat, true);
  assert.equal(unverified.reason, 'first_time');

  const partial = getVerificationStatus({
    isProfileVerified: true,
    isSelfieVerified: false,
    securityCheckPending: false,
  });
  assert.equal(partial.isFirstTimeVerified, false);
  assert.equal(partial.needsVerificationToChat, true);
  assert.equal(partial.reason, 'first_time');

  const verified = getVerificationStatus({
    isProfileVerified: true,
    isSelfieVerified: true,
    securityCheckPending: false,
  });
  assert.equal(verified.isFirstTimeVerified, true);
  assert.equal(verified.needsVerificationToChat, false);
  assert.equal(verified.reason, 'none');

  const periodicChallenge = getVerificationStatus({
    isProfileVerified: true,
    isSelfieVerified: true,
    securityCheckPending: true,
  });
  assert.equal(periodicChallenge.needsVerificationToChat, true);
  assert.equal(periodicChallenge.reason, 'security_check');

  const photoChangeGate = getVerificationStatus({
    isProfileVerified: false,
    isSelfieVerified: false,
    securityCheckPending: true,
    photoVerificationRequired: true,
  });
  assert.equal(photoChangeGate.needsVerificationToChat, true);
  assert.equal(photoChangeGate.photoVerificationRequired, true);
  assert.equal(photoChangeGate.reason, 'photo_change');
});

test('validateIdentitySubmission enforces legal name, document type, last4, 18+ DOB, and attestation', () => {
  assert.ok(
    validateIdentitySubmission({
      fullName: 'Al',
      docType: 'passport',
      last4: '1234',
      attested: true,
    })
  );
  assert.ok(
    validateIdentitySubmission({
      fullName: 'Aarav Sharma',
      docType: 'national_id',
      last4: '12',
      attested: true,
    })
  );
  assert.ok(
    validateIdentitySubmission({
      fullName: 'Aarav Sharma',
      docType: 'national_id',
      last4: '9A2F',
      attested: false,
    })
  );
  // Under-18 DOB fails Age Verification
  assert.ok(
    validateIdentitySubmission({
      fullName: 'Aarav Sharma',
      docType: 'national_id',
      last4: '9A2F',
      dob: '2015-05-01',
      attested: true,
    })
  );
  // Invalid DOB fails Age Verification
  assert.ok(
    validateIdentitySubmission({
      fullName: 'Aarav Sharma',
      docType: 'national_id',
      last4: '9A2F',
      dob: 'not-a-date',
      attested: true,
    })
  );
  assert.equal(
    validateIdentitySubmission({
      fullName: 'Aarav Sharma',
      docType: 'drivers_license',
      last4: '9A2F',
      dob: '1997-06-15',
      attested: true,
    }),
    null
  );
});

test('shouldTriggerPeriodicSecurityCheck runs only after first verification and outside cooldown', () => {
  const now = Date.UTC(2026, 10, 15, 12, 0, 0);

  // Never triggers before initial verification
  assert.equal(
    shouldTriggerPeriodicSecurityCheck({
      isFirstTimeVerified: false,
      securityCheckPending: false,
      chatsSinceSecurityCheck: 5,
      nowMs: now,
      randomRoll: 0.01,
    }),
    false
  );

  // Respects 6-hour cooldown after recent check
  assert.equal(
    shouldTriggerPeriodicSecurityCheck({
      isFirstTimeVerified: true,
      securityCheckPending: false,
      chatsSinceSecurityCheck: 5,
      lastSecurityCheckAt: new Date(now - 2 * 3_600_000),
      nowMs: now,
      randomRoll: 0.05,
    }),
    false
  );

  // Triggers via random spot check or >= 4 new chats once outside cooldown
  assert.equal(
    shouldTriggerPeriodicSecurityCheck({
      isFirstTimeVerified: true,
      securityCheckPending: false,
      chatsSinceSecurityCheck: 2,
      lastSecurityCheckAt: new Date(now - 8 * 3_600_000),
      nowMs: now,
      randomRoll: 0.1,
    }),
    true
  );

  assert.equal(
    shouldTriggerPeriodicSecurityCheck({
      isFirstTimeVerified: true,
      securityCheckPending: false,
      chatsSinceSecurityCheck: 4,
      lastSecurityCheckAt: new Date(now - 8 * 3_600_000),
      nowMs: now,
      randomRoll: 0.99,
    }),
    true
  );
});
