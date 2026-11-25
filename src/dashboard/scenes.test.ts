import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeScene, sceneTitle, scenesFromTurns } from './scenes.ts';

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
