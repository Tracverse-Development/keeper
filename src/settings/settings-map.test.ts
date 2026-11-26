import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GROUPS, SECTIONS, shown } from './settings-map.ts';

test('settings: every section is in one real group and no group is empty', () => {
  assert.equal(new Set(SECTIONS.map((s) => s.id)).size, SECTIONS.length);
  for (const g of GROUPS) assert.ok(SECTIONS.some((s) => s.group === g.id), `${g.title} has sections`);
  for (const s of SECTIONS) assert.ok(GROUPS.some((g) => g.id === s.group), s.id);
});

test('settings: a tab shows its own sections; a search finds a section wherever it lives', () => {
  assert.deepEqual([...shown('how', '')], ['reading', 'showing', 'spending', 'voice', 'button', 'phone']);
  assert.deepEqual([...shown('keeper', 'backup')], ['backup'], 'found from another tab');
  assert.deepEqual([...shown('health', 'passcode')], ['child']);
  assert.ok(shown('health', 'microphone').has('voice'));
  assert.equal(shown('health', 'zebra').size, 0);
});
