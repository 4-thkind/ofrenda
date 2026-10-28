// Ofrenda — tests for the audio limits and labels.
// The decoder itself needs a browser, so it is verified live; what can be
// tested here is the arithmetic around it.
// Run with: node test/audio.test.mjs

import assert from 'node:assert/strict';
import { formatDuration, withinLimit, lengthMessage, MAX_SECONDS, TARGET_RATE } from '../src/audio.js';

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

test('formatDuration shows seconds under a minute', () => {
  assert.equal(formatDuration(0), '0s');
  assert.equal(formatDuration(34), '34s');
  assert.equal(formatDuration(59.4), '59s');
});

test('formatDuration shows minutes and padded seconds', () => {
  assert.equal(formatDuration(60), '1:00');
  assert.equal(formatDuration(127), '2:07');
  assert.equal(formatDuration(180), '3:00');
});

test('formatDuration survives junk input', () => {
  assert.equal(formatDuration(null), '0s');
  assert.equal(formatDuration('nope'), '0s');
  assert.equal(formatDuration(-5), '0s');
});

test('withinLimit accepts a story and rejects an archive', () => {
  assert.equal(withinLimit(33), true);
  assert.equal(withinLimit(MAX_SECONDS), true);
  assert.equal(withinLimit(MAX_SECONDS + 1), false);
  assert.equal(withinLimit(0), false);
});

test('lengthMessage explains the limit in human terms', () => {
  assert.match(lengthMessage(400), /6:40/);
  assert.match(lengthMessage(400), /under 3:00/);
  assert.match(lengthMessage(0), /empty/);
});

test('the target rate is Whisper native', () => {
  assert.equal(TARGET_RATE, 16000);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
