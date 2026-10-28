// Ofrenda — tests for the card geometry.
// Run with: node test/card-layout.test.mjs

import assert from 'node:assert/strict';
import { wrapText, charsPerLine, layoutCard, fitsOnCard, CARD } from '../src/card-layout.js';

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

test('wrapText breaks on words and respects the width', () => {
  const lines = wrapText('the dough tells you when it is ready', 14);
  assert.ok(lines.length > 1);
  for (const line of lines) assert.ok(line.length <= 14, `"${line}" is too wide`);
  assert.equal(lines.join(' '), 'the dough tells you when it is ready');
});

test('wrapText keeps a short line intact', () => {
  assert.deepEqual(wrapText('ready', 20), ['ready']);
});

test('wrapText returns nothing for empty input', () => {
  assert.deepEqual(wrapText('', 20), []);
  assert.deepEqual(wrapText('   ', 20), []);
});

test('wrapText truncates with an ellipsis when the line budget runs out', () => {
  const lines = wrapText('one two three four five six seven eight nine ten', 12, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith('…'));
});

test('wrapText hard-breaks a word longer than the line', () => {
  const lines = wrapText('antidisestablishmentarianism', 10, 2);
  assert.ok(lines.length >= 1);
  assert.ok(lines[0].endsWith('…'));
});

test('charsPerLine grows with width and shrinks with font size', () => {
  assert.ok(charsPerLine(900, 30) > charsPerLine(900, 60));
  assert.ok(charsPerLine(1200, 30) > charsPerLine(600, 30));
  assert.ok(charsPerLine(10, 30) >= 6);
});

test('layoutCard places every block in reading order', () => {
  const layout = layoutCard({
    title: 'What the Kitchen Kept',
    name: 'Amma',
    years: '1938 – 2019',
    subtitle: 'grandmother · Kochi',
    quote: 'Every time I smell bread, I hear her humming in the kitchen.',
    remembrance: 'She measured nothing and remembered everything. The dough told her when it was ready.',
    footer: 'kept on 28 October 2026',
  });

  const ids = layout.blocks.map((b) => b.id);
  assert.deepEqual(ids, [
    'label',
    'title',
    'name',
    'years',
    'subtitle',
    'divider',
    'quote',
    'body',
    'flower',
    'footer',
  ]);

  const y = (id) => layout.blocks.find((b) => b.id === id).y;
  assert.ok(y('title') > y('label'));
  assert.ok(y('name') > y('title'));
  assert.ok(y('years') > y('name'));
  assert.ok(y('quote') > y('divider'));
  assert.ok(y('body') > y('quote'));
  assert.equal(y('footer'), CARD.height - 108);
});

test('layoutCard keeps everything on the paper', () => {
  const layout = layoutCard({
    title: 'A Very Long Title That Keeps Going For A While',
    name: 'Bartholomew Montgomery Fitzgerald',
    years: 'b. 1938',
    subtitle: 'a great-great-grandmother from a small town near the coast',
    quote:
      'She said the dough tells you when it is ready, you just have to listen, and then she would put her hand flat on the table and wait for the whole house to go quiet.',
    remembrance:
      'She measured nothing and remembered everything. The dough told her when it was ready, and she listened the way other people pray. What she left behind is not a recipe but a way of paying attention.',
    footer: 'kept on 28 October 2026 · made offline',
  });
  assert.equal(fitsOnCard(layout), true);
});

test('layoutCard shrinks the name font for long names', () => {
  const short = layoutCard({ name: 'Amma' });
  const long = layoutCard({ name: 'Bartholomew Montgomery Fitzgerald' });
  const size = (layout) => layout.blocks.find((b) => b.id === 'name').size;
  assert.ok(size(long) < size(short));
});

test('layoutCard caps the quote at five lines', () => {
  const layout = layoutCard({
    quote:
      'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one twenty-two twenty-three twenty-four twenty-five twenty-six twenty-seven twenty-eight twenty-nine thirty.',
  });
  const quote = layout.blocks.find((b) => b.id === 'quote');
  assert.ok(quote.lines.length <= 5);
});

test('layoutCard degrades to a nameless card without crashing', () => {
  const layout = layoutCard({});
  assert.equal(layout.blocks.find((b) => b.id === 'name').lines[0], 'A Memory');
  assert.equal(layout.blocks.find((b) => b.id === 'title').lines[0], 'A Story Kept');
  assert.equal(fitsOnCard(layout), true);
});

test('layoutCard never produces NaN coordinates', () => {
  const layout = layoutCard({ name: 'Amma', quote: 'Bread.', remembrance: 'Kept.' });
  for (const block of layout.blocks) {
    assert.ok(Number.isFinite(block.x), `${block.id} x`);
    assert.ok(Number.isFinite(block.y), `${block.id} y`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
