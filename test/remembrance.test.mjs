// Ofrenda — tests for the bouncer.
// Run with: node test/remembrance.test.mjs

import assert from 'node:assert/strict';
import {
  validateRemembrance,
  fallbackRemembrance,
  validateTitle,
  fallbackTitle,
  dedicationLine,
} from '../src/remembrance.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(`     ${error.message}`);
  }
}

const GOOD =
  'She measured nothing and remembered everything. The dough told her when it was ready, and she listened the way other people pray. What she left behind is not a recipe but a way of paying attention.';

test('validateRemembrance accepts three honest sentences', () => {
  assert.equal(validateRemembrance(GOOD), GOOD);
});

test('validateRemembrance strips a leading label', () => {
  assert.equal(validateRemembrance(`Remembrance: ${GOOD}`), GOOD);
});

test('validateRemembrance rejects greeting-card language', () => {
  assert.equal(
    validateRemembrance(
      'She was a loving memory to everyone who knew her. We will keep her in our hearts and she will never be forgotten. Rest in peace.'
    ),
    null
  );
});

test('validateRemembrance rejects markdown and headings', () => {
  assert.equal(validateRemembrance(`## ${GOOD}`), null);
  assert.equal(validateRemembrance(GOOD.replace('everything.', 'everything. **She listened.**')), null);
});

test('validateRemembrance rejects model apologies', () => {
  assert.equal(
    validateRemembrance('As an AI, I cannot write about a real person. I am sorry. Please provide more details.'),
    null
  );
});

test('validateRemembrance enforces length and sentence count', () => {
  assert.equal(validateRemembrance('She baked bread.'), null);
  assert.equal(validateRemembrance(`${GOOD} ${GOOD}`), null);
  assert.equal(validateRemembrance(`${GOOD} ${GOOD}`.slice(0, 400)), null);
});

test('validateRemembrance requires closing punctuation', () => {
  assert.equal(validateRemembrance(GOOD.replace(/\.$/, '')), null);
});

test('validateRemembrance refuses invented dialogue', () => {
  const withSpeech =
    'She always said the dough would tell her when it was ready. She would whisper “listen closely” and wait. The kitchen remembers her.';
  assert.equal(validateRemembrance(withSpeech), null);
});

test('validateRemembrance refuses a machine voice', () => {
  const machine =
    'The scent of warm bread fills my circuits with memories. She shaped each loaf with care. The kitchen still remembers her.';
  assert.equal(validateRemembrance(machine), null);
});

test('fallbackRemembrance names the person, the relationship and the place', () => {
  const text = fallbackRemembrance({ name: 'Amma', relationship: 'grandmother', place: 'Kochi' });
  assert.match(text, /^Amma, a grandmother, is remembered here\./);
  assert.match(text, /belongs to Kochi\./);
  assert.match(text, /still here\.$/);
});

test('fallbackRemembrance uses the right article and degrades gracefully', () => {
  assert.match(fallbackRemembrance({ name: 'Rao', relationship: 'uncle' }), /an uncle/);
  const bare = fallbackRemembrance({});
  assert.match(bare, /^This memory is remembered here\./);
  assert.match(bare, /belongs to the telling\./);
});

test('validateTitle accepts a short title and rejects instructions', () => {
  assert.equal(validateTitle('What the Kitchen Kept'), 'What the Kitchen Kept');
  assert.equal(validateTitle('"What the Kitchen Kept"'), 'What the Kitchen Kept');
  assert.equal(validateTitle('Kitchen'), null);
  assert.equal(validateTitle('Here is your title: what the kitchen kept'), null);
  assert.equal(validateTitle('one two three four five six seven'), null);
  assert.equal(validateTitle(''), null);
});

test('fallbackTitle follows the imagery in the quote', () => {
  assert.equal(fallbackTitle({ quote: 'She started the dough before the sun.' }), 'What the Kitchen Kept');
  assert.equal(fallbackTitle({ quote: 'The marigolds by the gate.' }), 'What the Garden Kept');
  assert.equal(fallbackTitle({ quote: 'She hummed while she worked.' }), 'A Song Still Humming');
  assert.equal(fallbackTitle({ quote: 'Nothing in particular happened.' }), 'A Story Kept');
});

test('dedicationLine joins relationship and place', () => {
  assert.equal(dedicationLine({ relationship: 'grandmother', place: 'Kochi' }), 'grandmother · Kochi');
  assert.equal(dedicationLine({ relationship: 'grandmother' }), 'grandmother');
  assert.equal(dedicationLine({ place: 'Kochi' }), 'Kochi');
  assert.equal(dedicationLine({}), 'a memory kept');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
