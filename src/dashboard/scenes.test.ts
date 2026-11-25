import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeScene, sceneTitle, scenesFromTurns, sceneSignature, parentIndex, parentTitle } from './scenes.ts';

const text = (title: string) => ({ kind: 'text' as const, id: 'panel-0', title, body: 'b' });

test('scenes come back from a chat, titled by their first panel, ids unique per scene', () => {
  const turns = [
    { id: 't1', said: 'teach me math', replied: '', mind: '', at: '', chat: 'c', panels: [text('The four building blocks')] },
    { id: 't2', said: 'just chatting', replied: '', mind: '', at: '', chat: 'c' },
    { id: 't3', said: 'explain the card Addition', replied: '', mind: '', at: '', chat: 'c', panels: [text('What addition means')] },
  ];
  const scenes = scenesFromTurns(turns);
  assert.deepEqual(scenes.map((s) => s.title), ['The four building blocks', 'What addition means']);
  assert.notEqual(scenes[0].panels[0].id, scenes[1].panels[0].id);
});

test('titles fall back to what was said and are kept short', () => {
  assert.equal(sceneTitle([], 'teach me'), 'teach me');
  assert.ok(sceneTitle([text('x'.repeat(200))], '').length <= 48);
  assert.equal(makeScene('s', [text('A')], '').panels[0].id, 's:panel-0');
});

test('a pinned copy of a scene is recognised as the same scene', () => {
  const panels = [{ id: 'panel-0', kind: 'text', title: 'Times table', body: '7 x 8' }] as never[];
  const live = makeScene('chat-1', panels, 'show me');
  assert.equal(sceneSignature(live.title, live.panels), sceneSignature('Times table', panels));
  assert.notEqual(sceneSignature('Times table', panels), sceneSignature('Other', panels));
});

test('a follow-up scene knows the scene it came from', () => {
  assert.equal(parentTitle('About "How a rainbow forms": explain the card Refraction.'), 'How a rainbow forms');
  assert.equal(parentTitle('Explain rainbows'), undefined);
  const lesson = makeScene('a', [{ id: 'p', kind: 'cards', title: 'How a rainbow forms', cards: [] }] as never[], 'Explain rainbows');
  const other = makeScene('b', [{ id: 'p', kind: 'text', title: 'Weather', body: '' }] as never[], 'weather');
  const follow = makeScene('c', [{ id: 'p', kind: 'text', title: 'Refraction', body: '' }] as never[], 'About "How a rainbow forms": explain the card Refraction.');
  assert.equal(parentIndex([lesson, other, follow], 2), 0);
  assert.equal(parentIndex([lesson, other, follow], 1), -1);
});
