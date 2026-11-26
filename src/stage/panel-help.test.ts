import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PANEL_HELP } from './panel-help.ts';

test('panels: every kind says what you can do with it, in one short plain sentence', () => {
  const lines = Object.entries(PANEL_HELP);
  assert.ok(lines.length >= 23);
  for (const [kind, line] of lines) {
    assert.ok(line.length >= 20 && line.length <= 70, `${kind}: ${line.length} characters`);
    assert.ok(/[.]$/.test(line) && !/[<>{}]/.test(line), `${kind} ends as a sentence`);
  }
  assert.equal(new Set(lines.map(([, l]) => l)).size, lines.length, 'no two kinds share a line');
});
