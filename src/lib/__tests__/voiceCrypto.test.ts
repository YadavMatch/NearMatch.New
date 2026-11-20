import assert from 'node:assert/strict';
import test from 'node:test';
import { VOLUMETRIC_LIMITS } from '../limits.ts';
import {
  buildVoiceMessageSummary,
  decryptVoiceBytes,
  encryptVoiceBytes,
  formatVoiceDuration,
  sanitizeAudioMimeType,
} from '../voiceCrypto.ts';

test('encryptVoiceBytes and decryptVoiceBytes roundtrip across either participant order', async () => {
  const sampleAudio = new Uint8Array([1, 2, 3, 4, 88, 99, 120, 250, 14, 7]);
  const payload = await encryptVoiceBytes({
    audioBytes: sampleAudio,
    mimeType: 'audio/webm;codecs=opus',
    durationSec: 6.4,
    conversationId: 'match_alice_bob',
    senderUid: 'alice_uid',
    recipientUid: 'bob_uid',
    clientId: 'client_msg_1',
  });

  assert.equal(payload.mimeType, 'audio/webm;codecs=opus');
  assert.equal(payload.durationSec, 6.4);
  assert.ok(payload.ciphertextBase64.length >= 16);
  assert.ok(payload.ivBase64.length >= 12);

  // Decryption works regardless of sender/recipient order because key derivation sorts participant UIDs.
  const decryptedByRecipient = await decryptVoiceBytes({
    ciphertextBase64: payload.ciphertextBase64,
    ivBase64: payload.ivBase64,
    conversationId: 'match_alice_bob',
    senderUid: 'bob_uid',
    recipientUid: 'alice_uid',
    clientId: 'client_msg_1',
  });

  assert.deepEqual(decryptedByRecipient, sampleAudio);
});

test('decryptVoiceBytes fails on wrong conversation, wrong participant, tampered AAD clientId, or tampered ciphertext', async () => {
  const sampleAudio = new Uint8Array([10, 20, 30, 40, 50, 60]);
  const payload = await encryptVoiceBytes({
    audioBytes: sampleAudio,
    mimeType: 'audio/mp4',
    durationSec: 3.2,
    conversationId: 'match_1',
    senderUid: 'user_a',
    recipientUid: 'user_b',
    clientId: 'msg_99',
  });

  await assert.rejects(() =>
    decryptVoiceBytes({
      ciphertextBase64: payload.ciphertextBase64,
      ivBase64: payload.ivBase64,
      conversationId: 'match_other',
      senderUid: 'user_a',
      recipientUid: 'user_b',
      clientId: 'msg_99',
    })
  );

  await assert.rejects(() =>
    decryptVoiceBytes({
      ciphertextBase64: payload.ciphertextBase64,
      ivBase64: payload.ivBase64,
      conversationId: 'match_1',
      senderUid: 'user_a',
      recipientUid: 'user_intruder',
      clientId: 'msg_99',
    })
  );

  await assert.rejects(() =>
    decryptVoiceBytes({
      ciphertextBase64: payload.ciphertextBase64,
      ivBase64: payload.ivBase64,
      conversationId: 'match_1',
      senderUid: 'user_a',
      recipientUid: 'user_b',
      clientId: 'msg_tampered',
    })
  );

  const flipped =
    payload.ciphertextBase64.slice(0, -2) +
    (payload.ciphertextBase64.endsWith('A=') ? 'B=' : 'A=');
  await assert.rejects(() =>
    decryptVoiceBytes({
      ciphertextBase64: flipped,
      ivBase64: payload.ivBase64,
      conversationId: 'match_1',
      senderUid: 'user_a',
      recipientUid: 'user_b',
      clientId: 'msg_99',
    })
  );
});

test('encryptVoiceBytes rejects empty audio and oversized payloads and clamps duration/mime', async () => {
  await assert.rejects(
    () =>
      encryptVoiceBytes({
        audioBytes: new Uint8Array(0),
        mimeType: 'audio/webm',
        durationSec: 2,
        conversationId: 'c1',
        senderUid: 'u1',
        recipientUid: 'u2',
        clientId: 'm1',
      }),
    /empty/i
  );

  const oversized = new Uint8Array(VOLUMETRIC_LIMITS.MAX_VOICE_CIPHERTEXT_LEN);
  await assert.rejects(
    () =>
      encryptVoiceBytes({
        audioBytes: oversized,
        mimeType: 'audio/webm',
        durationSec: 25,
        conversationId: 'c1',
        senderUid: 'u1',
        recipientUid: 'u2',
        clientId: 'm1',
      }),
    /too large/i
  );

  const clamped = await encryptVoiceBytes({
    audioBytes: new Uint8Array([42, 43, 44]),
    mimeType: 'text/html',
    durationSec: 120,
    conversationId: 'c1',
    senderUid: 'u1',
    recipientUid: 'u2',
    clientId: 'm2',
  });
  assert.equal(clamped.mimeType, 'audio/webm');
  assert.equal(clamped.durationSec, VOLUMETRIC_LIMITS.MAX_VOICE_DURATION_SEC);
});

test('voice formatting helpers use accurate non-E2EE summary copy', () => {
  assert.equal(formatVoiceDuration(0), '0:00');
  assert.equal(formatVoiceDuration(9.4), '0:09');
  assert.equal(formatVoiceDuration(25), '0:25');
  assert.equal(buildVoiceMessageSummary(12), 'Voice note (encrypted) (0:12)');
  assert.equal(sanitizeAudioMimeType('audio/ogg;codecs=opus'), 'audio/ogg;codecs=opus');
  assert.equal(sanitizeAudioMimeType('application/javascript'), 'audio/webm');
});
