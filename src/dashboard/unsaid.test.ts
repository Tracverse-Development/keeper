import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formMessage, REST_ON_SCREEN, SPOKEN_MAX, spokenPart, unsaid } from './unsaid.ts';

test('the reply is never said twice', () => {
  assert.equal(unsaid('Here it is.', ''), 'Here it is.');
  assert.equal(unsaid('Here it is.', 'Here it is.'), '');
  assert.equal(unsaid('Here it is. Opened Safari.', 'Here it is.'), 'Opened Safari.');
  assert.equal(unsaid('Something else entirely.', 'Here it is.'), 'Something else entirely.');
});

test('a submitted form becomes the next message', () => {
  assert.equal(formMessage('Plan your trip', { where_to: 'Edinburgh', people: '4', notes: ' ' }), 'My answers for "Plan your trip": where to: Edinburgh; people: 4.');
});

test('a long reply is spoken as its first two sentences, then says the rest is on screen', () => {
  assert.equal(spokenPart('Sure. Opened Notes.'), 'Sure. Opened Notes.', 'a short reply is said whole');
  const long = `The launch moved to Thursday. Three things are left before then. ${'Then a great deal more detail follows. '.repeat(12)}`;
  const said = spokenPart(long);
  assert.equal(said, `The launch moved to Thursday. Three things are left before then. ${REST_ON_SCREEN}`);
  // The first sentence was already said early: only the second and the note are left to say.
  assert.equal(unsaid(said, 'The launch moved to Thursday.'), `Three things are left before then. ${REST_ON_SCREEN}`);
  const noStops = spokenPart('word '.repeat(200));
  assert.ok(noStops.endsWith(REST_ON_SCREEN) && noStops.length <= SPOKEN_MAX + REST_ON_SCREEN.length + 2, 'no sentence end: cut at a word');
  const oneHuge = spokenPart(`${'very '.repeat(80)}long sentence. Short one.`);
  assert.ok(oneHuge.endsWith(REST_ON_SCREEN) && oneHuge.length < 340);
});
