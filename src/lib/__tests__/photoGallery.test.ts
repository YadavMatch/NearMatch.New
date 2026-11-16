import test from 'node:test';
import assert from 'node:assert/strict';
import {
  havePhotosChanged,
  normalizePhotoList,
  validatePhotoGallery,
} from '../photoGallery.ts';
import { VOLUMETRIC_LIMITS } from '../limits.ts';

const FIVE_VALID_PHOTOS = [
  '/portraits/p1.png',
  '/portraits/p2.png',
  '/portraits/p3.png',
  '/portraits/p4.png',
  'https://example.com/photo5.jpg',
];

test('validatePhotoGallery enforces 5 to 6 valid images', () => {
  assert.ok(validatePhotoGallery([]));
  assert.ok(validatePhotoGallery(FIVE_VALID_PHOTOS.slice(0, 4)));
  assert.equal(validatePhotoGallery(FIVE_VALID_PHOTOS), null);
  assert.equal(
    validatePhotoGallery([...FIVE_VALID_PHOTOS, 'data:image/jpeg;base64,abc123']),
    null
  );
  assert.ok(
    validatePhotoGallery([
      ...FIVE_VALID_PHOTOS,
      'https://example.com/photo6.jpg',
      'https://example.com/photo7.jpg',
    ])
  );
});

test('validatePhotoGallery rejects invalid URLs and oversized payloads', () => {
  assert.ok(
    validatePhotoGallery([...FIVE_VALID_PHOTOS.slice(0, 4), 'javascript:alert(1)'])
  );
  const oversized = `data:image/jpeg;base64,${'a'.repeat(VOLUMETRIC_LIMITS.MAX_PHOTO_URL_LEN + 1)}`;
  assert.ok(validatePhotoGallery([...FIVE_VALID_PHOTOS.slice(0, 4), oversized]));
});

test('havePhotosChanged detects additions, removals, replacements, and reordering', () => {
  assert.equal(havePhotosChanged(FIVE_VALID_PHOTOS, [...FIVE_VALID_PHOTOS]), false);
  assert.equal(
    havePhotosChanged(FIVE_VALID_PHOTOS, [...FIVE_VALID_PHOTOS, '/portraits/p6.png']),
    true
  );
  assert.equal(
    havePhotosChanged(FIVE_VALID_PHOTOS, [
      FIVE_VALID_PHOTOS[1],
      FIVE_VALID_PHOTOS[0],
      ...FIVE_VALID_PHOTOS.slice(2),
    ]),
    true
  );
  assert.equal(
    havePhotosChanged(FIVE_VALID_PHOTOS, [
      ...FIVE_VALID_PHOTOS.slice(0, 4),
      'https://example.com/other.jpg',
    ]),
    true
  );
});

test('normalizePhotoList trims, removes invalid entries, and caps at MAX_PHOTOS', () => {
  const normalized = normalizePhotoList([
    '  /portraits/p1.png ',
    '',
    'ftp://bad.example.com/x.png',
    'https://example.com/a.jpg',
    '/portraits/p2.png',
    '/portraits/p3.png',
    '/portraits/p4.png',
    '/portraits/p5.png',
    '/portraits/p6.png',
  ]);
  assert.equal(normalized.length, VOLUMETRIC_LIMITS.MAX_PHOTOS);
  assert.equal(normalized[0], '/portraits/p1.png');
  assert.equal(normalized.includes('ftp://bad.example.com/x.png'), false);
});
