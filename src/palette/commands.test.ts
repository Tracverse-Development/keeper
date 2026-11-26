import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rank } from './rank.ts';
import { paletteCommands } from './palette-commands.ts';

const noop = () => {};
const base = { keepers: [{ id: 'a', name: 'Trini Boi' }, { id: 'b', name: 'Pup' }], activeKeeper: 'a', pinned: [{ id: 'p1', title: 'Times table' }], busy: false, activate: noop, newChat: noop, brief: noop, week: noop, focus: noop, stop: noop, openSettings: noop, openStudio: noop, openMemory: noop, openScenes: noop, openPinned: noop };

test('the palette offers the other keepers, pinned scenes, and Stop only while busy', () => {
  const ids = paletteCommands(base).map((c) => c.id);
  assert.ok(ids.includes('keeper-b') && !ids.includes('keeper-a'), 'switch to the others, not the one on screen');
  assert.ok(ids.includes('pin-p1') && !ids.includes('stop'));
  assert.equal(paletteCommands({ ...base, busy: true })[0].id, 'stop', 'Stop comes first while a turn runs');
  assert.equal(rank(paletteCommands(base), 'pup')[0].id, 'keeper-b');
  assert.equal(rank(paletteCommands(base), 'wardrobe')[0].id, 'studio', 'the wardrobe lives in the Studio');
  assert.equal(rank(paletteCommands(base), 'brain')[0].id, 'settings');
});
