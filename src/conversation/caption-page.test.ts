/** Run: node --test --experimental-strip-types src/conversation/caption-page.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captionPage, liveTail } from './caption-page.ts';

test('a short reply is shown whole', () => {
  assert.deepEqual(captionPage('  It is 3 pm\nin Tokyo. '), { shown: 'It is 3 pm in Tokyo.', more: false });
});

test('a long reply shows whole sentences up to the limit, and says there is more', () => {
  const reply = 'A rainbow forms when sunlight enters raindrops. The light bends and splits into colours. It reflects off the back of each drop and leaves at about 42 degrees, which is why you see an arc.';
  const page = captionPage(reply, 100);
  assert.equal(page.shown, 'A rainbow forms when sunlight enters raindrops. The light bends and splits into colours.');
  assert.ok(page.more);
});

test('one long sentence shows its first words with an ellipsis', () => {
  const page = captionPage('word '.repeat(80), 50);
  assert.ok(page.more && page.shown.endsWith('…') && page.shown.length <= 51);
  assert.ok(!page.shown.includes('  '));
});

test('a reply still arriving keeps its newest words in view', () => {
  assert.equal(liveTail('Hello there'), 'Hello there');
  const tail = liveTail('one two three four five six seven eight nine ten', 20);
  assert.ok(tail.startsWith('…') && tail.endsWith('ten') && tail.length <= 21);
  assert.ok(!tail.slice(1).startsWith(' '));
});
