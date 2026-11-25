import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nodeFinding, shortId, suggestedMind, validName } from './steps.ts';

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
