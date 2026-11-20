import { VOLUMETRIC_LIMITS } from './limits.ts';

export interface EncryptedVoicePayload {
  ciphertextBase64: string;
  ivBase64: string;
  mimeType: string;
  durationSec: number;
}

const VOICE_DOMAIN_TAG = 'nearmatch.voice.e2ee.v1';
const VOICE_HKDF_SALT = 'nearmatch-voice-hkdf-salt-2026';
const VOICE_HKDF_INFO = 'nearmatch-aes-256-gcm-voice-note';
const AUDIO_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const;

function getWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Encrypted voice messaging requires Web Crypto support in this browser.');
  }
  return globalThis.crypto;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function formatVoiceDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function buildVoiceMessageSummary(durationSec: number): string {
  // "Voice note (encrypted)" rather than "Encrypted voice note": the note is
  // encrypted at rest, but the key is derivable server-side, so the wording
  // must not read as a claim of end-to-end encryption.
  return `Voice note (encrypted) (${formatVoiceDuration(durationSec)})`;
}

export function sanitizeAudioMimeType(rawMimeType: string): string {
  const clean = rawMimeType.trim().slice(0, VOLUMETRIC_LIMITS.MAX_VOICE_MIME_LEN);
  if (/^audio\/[a-zA-Z0-9.+;= \-]+$/.test(clean)) {
    return clean;
  }
  return 'audio/webm';
}

export function pickSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  for (const candidate of AUDIO_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return '';
}

function buildVoiceAdditionalData(conversationId: string, clientId: string): Uint8Array {
  return new TextEncoder().encode(`${conversationId}|${clientId}`);
}

export async function deriveConversationVoiceKey(
  conversationId: string,
  participantA: string,
  participantB: string
): Promise<CryptoKey> {
  const webCrypto = getWebCrypto();
  const [lowUid, highUid] = [participantA, participantB].sort();
  const encoder = new TextEncoder();
  const seedMaterial = encoder.encode(`${VOICE_DOMAIN_TAG}|${conversationId}|${lowUid}|${highUid}`);
  const hashedSeed = await webCrypto.subtle.digest('SHA-256', seedMaterial);

  const baseKey = await webCrypto.subtle.importKey('raw', hashedSeed, 'HKDF', false, ['deriveKey']);
  return webCrypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(VOICE_HKDF_SALT),
      info: encoder.encode(VOICE_HKDF_INFO),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptVoiceBytes(params: {
  audioBytes: Uint8Array;
  mimeType: string;
  durationSec: number;
  conversationId: string;
  senderUid: string;
  recipientUid: string;
  clientId: string;
}): Promise<EncryptedVoicePayload> {
  if (params.audioBytes.byteLength === 0) {
    throw new Error('Recorded voice note is empty. Hold or tap Record to capture audio.');
  }

  const webCrypto = getWebCrypto();
  const key = await deriveConversationVoiceKey(
    params.conversationId,
    params.senderUid,
    params.recipientUid
  );
  const iv = webCrypto.getRandomValues(new Uint8Array(12));
  const additionalData = buildVoiceAdditionalData(params.conversationId, params.clientId);
  const plainBuffer = new Uint8Array(params.audioBytes).buffer;
  const aadBuffer = new Uint8Array(additionalData).buffer;

  const encryptedBuffer = await webCrypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aadBuffer,
    },
    key,
    plainBuffer
  );

  const ciphertextBase64 = bytesToBase64(new Uint8Array(encryptedBuffer));
  const ivBase64 = bytesToBase64(iv);
  if (ciphertextBase64.length > VOLUMETRIC_LIMITS.MAX_VOICE_CIPHERTEXT_LEN) {
    throw new Error(
      `Voice note is too large to send (${Math.round(ciphertextBase64.length / 1024)} KB). Keep recordings under ${VOLUMETRIC_LIMITS.MAX_VOICE_DURATION_SEC}s.`
    );
  }

  const clampedDuration = Math.max(
    0.5,
    Math.min(VOLUMETRIC_LIMITS.MAX_VOICE_DURATION_SEC, Math.round(params.durationSec * 10) / 10)
  );

  return {
    ciphertextBase64,
    ivBase64,
    mimeType: sanitizeAudioMimeType(params.mimeType),
    durationSec: clampedDuration,
  };
}

export async function decryptVoiceBytes(params: {
  ciphertextBase64: string;
  ivBase64: string;
  conversationId: string;
  senderUid: string;
  recipientUid: string;
  clientId: string;
}): Promise<Uint8Array> {
  const webCrypto = getWebCrypto();
  const key = await deriveConversationVoiceKey(
    params.conversationId,
    params.senderUid,
    params.recipientUid
  );
  const iv = new Uint8Array(base64ToBytes(params.ivBase64));
  const ciphertext = new Uint8Array(base64ToBytes(params.ciphertextBase64));
  const additionalData = new Uint8Array(
    buildVoiceAdditionalData(params.conversationId, params.clientId)
  );

  const decryptedBuffer = await webCrypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData,
    },
    key,
    ciphertext
  );

  return new Uint8Array(decryptedBuffer);
}
