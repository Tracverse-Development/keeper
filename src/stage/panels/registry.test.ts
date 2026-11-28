import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// The registry draws with React components (.tsx), which node cannot load, so this reads its
// source: each kit is written `  <kind>: {` then `label: '…',` and `help: '…',` on their own lines.
const registry = readFileSync(new URL('./registry.tsx', import.meta.url), 'utf8');
const spec = readFileSync(new URL('../../kernel/panel-spec.ts', import.meta.url), 'utf8');

const quoted = String.raw`'((?:\\.|[^'\\])*)'`;
const kits = [...registry.matchAll(new RegExp(String.raw`^  ([a-z]+): \{\n    label: ${quoted},\n    help: ${quoted},\n    wide: [^\n]+,\n    draw: ([A-Z][A-Za-z]+Panel),\n  \},`, 'gm'))]
  .map(([, kind, label, help, draw]) => ({ kind: kind!, label: label!, help: help!, draw: draw! }));

test('panels: every panel kind in the contract has a kit in the registry', () => {
  const kinds = [...spec.matchAll(/kind: '([a-z]+)'; id: string/g)].map((m) => m[1]);
  assert.ok(kinds.length >= 24);
  assert.deepEqual(kits.map((k) => k.kind), kinds, 'one kit per kind, in the order of panel-spec.ts');
});

test('panels: every kind says what you can do with it, in one short plain sentence', () => {
  for (const { kind, help } of kits) {
    assert.ok(help.length >= 20 && help.length <= 70, `${kind}: ${help.length} characters`);
    assert.ok(/[.]$/.test(help) && !/[<>{}]/.test(help), `${kind} ends as a sentence`);
  }
  assert.equal(new Set(kits.map((k) => k.help)).size, kits.length, 'no two kinds share a line');
});

test('panels: every kind has a label and its own renderer file', () => {
  for (const { kind, label, draw } of kits) {
    assert.ok(label.length > 0 && label.length <= 20, `${kind} label`);
    assert.ok(registry.includes(`import { ${draw} } from './${draw}.tsx';`), `${kind} imports ${draw}`);
  }
  assert.equal(new Set(kits.map((k) => k.draw)).size, kits.length, 'no two kinds share a renderer');
});
