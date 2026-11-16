import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildIcebreakerSuggestions,
  detectCommonInterests,
} from '../icebreakers.ts';

test('detectCommonInterests finds case-insensitive overlap and falls back to matchReasons', () => {
  const overlap = detectCommonInterests(
    ['Specialty Coffee', 'Indie Cinema', 'Ceramics'],
    ['specialty coffee', 'Trail Running', 'ceramics']
  );
  assert.deepEqual(overlap, ['Specialty Coffee', 'Ceramics']);

  const fromReasons = detectCommonInterests(
    ['Specialty Coffee', 'Live Jazz'],
    [],
    ['2.1 km from you', '2 shared interests: Specialty Coffee, Live Jazz']
  );
  assert.deepEqual(fromReasons, ['Specialty Coffee', 'Live Jazz']);
});

test('buildIcebreakerSuggestions prioritizes tailored questions for shared profile tags', () => {
  const suggestions = buildIcebreakerSuggestions({
    viewerInterests: ['Specialty Coffee', 'Bookstores', 'Vinyl Records'],
    partnerInterests: ['Bookstores', 'Vinyl Records', 'Cycling'],
    partnerName: 'Diya Nair',
    partnerCity: 'Bandra West, Mumbai',
    conversationId: 'conv_123',
    maxCount: 3,
  });

  assert.equal(suggestions.length, 3);
  assert.equal(suggestions[0].isCommonInterest, true);
  assert.equal(suggestions[0].interest, 'Bookstores');
  assert.equal(suggestions[1].isCommonInterest, true);
  assert.equal(suggestions[1].interest, 'Vinyl Records');
  assert.equal(suggestions[2].isCommonInterest, false);
  assert.ok(suggestions[0].question.length > 15);
});

test('buildIcebreakerSuggestions handles custom shared tags and zero-overlap profiles cleanly', () => {
  const customShared = buildIcebreakerSuggestions({
    viewerInterests: ['Pottery Wheel'],
    partnerInterests: ['pottery wheel'],
    partnerName: 'Kabir Mehta',
    conversationId: 'conv_custom',
    maxCount: 2,
  });

  assert.equal(customShared[0].isCommonInterest, true);
  assert.equal(customShared[0].interest, 'Pottery Wheel');
  assert.ok(customShared[0].question.includes('pottery wheel'));

  const zeroOverlap = buildIcebreakerSuggestions({
    viewerInterests: ['Cycling'],
    partnerInterests: ['Live Jazz'],
    partnerName: 'Meera Kapoor',
    partnerCity: 'Colaba, Mumbai',
    conversationId: 'conv_none',
    maxCount: 3,
  });

  assert.equal(zeroOverlap.length, 3);
  assert.equal(zeroOverlap.every((s) => !s.isCommonInterest), true);
  assert.ok(zeroOverlap[0].question.includes('Meera'));
  assert.ok(zeroOverlap[0].question.includes('Colaba, Mumbai'));
});
