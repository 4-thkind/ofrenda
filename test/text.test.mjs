// Ofrenda — tests for the text rules.
// Run with: node test/text.test.mjs

import assert from 'node:assert/strict';
import {
  cleanTranscript,
  splitSentences,
  wordCount,
  quoteCandidates,
  pickQuote,
  formatYears,
  titleCase,
  ellipsize,
} from '../src/text.js';

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

const STORY =
  'Every Sunday my grandmother woke before the sun and started the dough. She never used a recipe. She said the dough tells you when it is ready, you just have to listen. When I was nine she let me shape the first loaf. She passed in the spring of 2019. But every time I smell bread, I hear her humming in the kitchen.';

test('cleanTranscript collapses whitespace and fixes spacing before punctuation', () => {
  assert.equal(cleanTranscript('  she  said   hello , world .  '), 'She said hello, world.');
});

test('cleanTranscript strips wrapping quotes and capitalises', () => {
  assert.equal(cleanTranscript('"the dough is ready."'), 'The dough is ready.');
});

test('cleanTranscript returns empty for empty input', () => {
  assert.equal(cleanTranscript('   '), '');
  assert.equal(cleanTranscript(null), '');
});

test('splitSentences finds the six sentences in the story', () => {
  assert.equal(splitSentences(STORY).length, 6);
});

test('splitSentences does not break on an abbreviation', () => {
  const sentences = splitSentences('Dr. Rao kept the recipe. She never wrote it down.');
  assert.equal(sentences.length, 2);
  assert.equal(sentences[0], 'Dr. Rao kept the recipe.');
});

test('wordCount counts words, not characters', () => {
  assert.equal(wordCount('the dough is ready'), 4);
  assert.equal(wordCount(''), 0);
});

test('quoteCandidates prefers the sensory first-person line', () => {
  const ranked = quoteCandidates(splitSentences(STORY));
  assert.match(ranked[0].text, /smell bread/);
});

test('quoteCandidates pushes funeral language down', () => {
  const ranked = quoteCandidates(splitSentences(STORY));
  const grief = ranked.find((c) => /passed in the spring/.test(c.text));
  assert.ok(grief.score < ranked[0].score);
  assert.ok(grief.reasons.includes('grief, not memory'));
});

test('quoteCandidates sorts by score and breaks ties by position', () => {
  const ranked = quoteCandidates(['Short.', 'I smell the rain on the porch.', 'I hear the rain on the porch.']);
  assert.ok(ranked[0].score >= ranked[1].score);
  const tied = quoteCandidates(['I hear the rain on the porch.', 'I smell the rain on the porch.']);
  assert.equal(tied[0].index, 0);
});

test('pickQuote returns the best sentence, or empty string', () => {
  assert.match(pickQuote(splitSentences(STORY)), /smell bread/);
  assert.equal(pickQuote([]), '');
});

test('formatYears handles every combination', () => {
  assert.equal(formatYears('1938', '2019'), '1938 – 2019');
  assert.equal(formatYears('1938', ''), 'b. 1938');
  assert.equal(formatYears('', '2019'), 'd. 2019');
  assert.equal(formatYears('', ''), '');
});

test('titleCase normalises shouting', () => {
  assert.equal(titleCase('WHAT THE KITCHEN KEPT'), 'What The Kitchen Kept');
});

test('ellipsize cuts at a word boundary and marks the cut', () => {
  assert.equal(ellipsize('short', 20), 'short');
  assert.equal(ellipsize('the dough tells you when it is ready', 18), 'the dough tells…');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
