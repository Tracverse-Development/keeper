import assert from 'node:assert/strict';
import { test } from 'node:test';

import { changes, receiptLine, undoRequest } from './receipt-view.ts';

const steps = [
  { tool: 'Bash', detail: 'ls ~/Downloads' },
  { tool: 'Bash', detail: 'mkdir -p ~/Downloads/Archive' },
  { tool: 'Bash', detail: 'mv ~/Downloads/a.pdf ~/Downloads/Archive/' },
  { tool: 'Bash', detail: 'mv ~/Downloads/a.pdf ~/Downloads/Archive/' },
  { tool: 'Bash', detail: 'df -h' },
];

test('receipt: only what changed something is on it, once each, in order', () => {
  const list = changes(steps);
  assert.deepEqual(list.map((c) => c.kind), ['create', 'move']);
  assert.ok(list.every((c) => !c.words.includes('mkdir') && !c.words.includes('mv')), 'never a raw command');
  assert.equal(receiptLine(list), '2 changes on your computer');
  assert.equal(changes([{ tool: 'Bash', detail: 'ls ~' }]).length, 0, 'looking leaves no receipt');
  assert.match(receiptLine(changes([{ tool: 'Bash', detail: 'rm ~/Downloads/old.zip' }])), /^1 change on your computer, including something removed$/);
});

test('receipt: the undo request names each change and stays within a message', () => {
  const request = undoRequest(changes(steps));
  assert.match(request, /^Undo what you just did/);
  assert.ok(request.includes('1. ') && request.includes('2. ') && request.includes('mv ~/Downloads/a.pdf'));
  assert.ok(request.includes('opposite order'));
  const many = Array.from({ length: 60 }, (_, i) => ({ tool: 'Bash', detail: `mv ~/Downloads/file-${i}-${'x'.repeat(120)}.pdf ~/Archive/` }));
  assert.ok(undoRequest(changes(many)).length <= 1800);
});
