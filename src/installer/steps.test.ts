import { test } from 'node:test';
import assert from 'node:assert/strict';

import { foldersPermission, nodeFinding, pimPermission, shortId, STEPS, suggestedMind, validName, voicePermission } from './steps.ts';

const scan = { node: null, silentNodes: [], ollamaModels: [], hermesInstalled: false, voiceHelper: true, computerName: 'Mac' };

test('the node finding reads the scan', () => {
  assert.equal(nodeFinding(scan), 'none');
  assert.equal(nodeFinding({ ...scan, silentNodes: ['/x'] }), 'stopped');
  assert.equal(nodeFinding({ ...scan, node: { home: '/x', port: 9200, status: { name: 'n', version: '10.0.26', networkName: '', peerId: '' } } }), 'found');
});

test('a local model is suggested first', () => {
  assert.deepEqual(suggestedMind(scan), { brain: 'reflex', model: '' });
  assert.deepEqual(suggestedMind({ ...scan, ollamaModels: ['llama3.2:3b'] }), { brain: 'ollama', model: 'llama3.2:3b' });
});

test('names match the core rule', () => {
  assert.ok(validName('Umoja'));
  assert.ok(validName('Ark Helper 2'));
  assert.ok(!validName(''));
  assert.ok(!validName('<script>'));
  assert.ok(!validName('x'.repeat(25)));
});

test('long ids shorten in the middle', () => {
  assert.equal(shortId('abc'), 'abc');
  assert.equal(shortId('did:dkg:base:84532/0x26b43030c0cc4f7a041e7377a44e31551b89c3fc/456', 6), 'did:dk…fc/456');
});

test('the steps, in order, with permissions asked up front', () => {
  assert.deepEqual(STEPS.map((s) => s.title), ['Welcome', 'Memory node', 'Your keeper', 'Mind', 'Permissions', 'Meet']);
  assert.deepEqual(STEPS.map((s) => s.id), ['welcome', 'node', 'graph', 'mind', 'permissions', 'meet']);
});

test('the microphone is allowed only when speech and the mic both are', () => {
  assert.equal(voicePermission(null), 'waiting');
  assert.equal(voicePermission({ speech: 'authorized', mic: true }), 'allowed');
  assert.equal(voicePermission({ speech: 'authorized', mic: false }), 'denied');
  assert.equal(voicePermission({ speech: 'denied', mic: true }), 'denied');
});

test('folders are allowed only when every one is', () => {
  assert.equal(foldersPermission(null), 'waiting');
  assert.equal(foldersPermission([]), 'denied');
  assert.equal(foldersPermission([{ folder: 'Desktop', granted: true }, { folder: 'Documents', granted: true }]), 'allowed');
  assert.equal(foldersPermission([{ folder: 'Desktop', granted: true }, { folder: 'Downloads', granted: false }]), 'denied');
});

test('calendar and contacts are allowed only when both are', () => {
  assert.equal(pimPermission(null), 'waiting');
  assert.equal(pimPermission({ calendar: 'allowed', contacts: 'notasked' }), 'waiting');
  assert.equal(pimPermission({ calendar: 'allowed', contacts: 'denied' }), 'denied');
  assert.equal(pimPermission({ calendar: 'allowed', contacts: 'allowed' }), 'allowed');
});

// FIX-0036: on a ~1024 px window "Welcome" was squeezed into a sixth of the row and ran into the
// "2" dot. The named step keeps its full width (it never shrinks) and its name can only ellipsize.
test('the named step in the step bar never shrinks under its name', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('./installer.css', import.meta.url), 'utf8');
  assert.match(css, /\.stepper li\.is-current \{ flex: 1 0 auto;/);
  assert.match(css, /\.stepper-label \{[^}]*min-width: 0;[^}]*text-overflow: ellipsis;/);
});
