import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shortcutSymbols } from './shortcut.ts';
import { AFTER_SPEECH_MS, hideAfter, INITIAL, NOTHING_HEARD_MS, phaseLine, talkReducer, UNSPOKEN_REPLY_MS, type TalkInput } from './talk-state.ts';

test('shortcuts read as Mac symbols', () => {
  assert.equal(shortcutSymbols('Alt+Space'), '⌥Space');
  assert.equal(shortcutSymbols('CommandOrControl+Shift+K'), '⇧⌘K');
  assert.equal(shortcutSymbols('Shift+Ctrl+Alt+Cmd+KeyJ'), '⌃⌥⇧⌘J');
  assert.equal(shortcutSymbols('F5'), 'F5');
  assert.equal(shortcutSymbols('ctrl+digit5'), '⌃5');
  assert.equal(shortcutSymbols(''), '');
});

const run = (...inputs: TalkInput[]) => inputs.reduce(talkReducer, INITIAL);

test('one push-to-talk turn: words, thinking, reply, spoken, hide', () => {
  let s = run({ kind: 'voice', event: { type: 'listening', on: true } }, { kind: 'voice', event: { type: 'level', value: 3 } });
  assert.equal(s.stage, 'listening');
  assert.equal(s.level, 1);
  assert.equal(hideAfter(s), null);
  s = run({ kind: 'voice', event: { type: 'listening', on: true } }, { kind: 'voice', event: { type: 'partial', text: 'what do' } }, { kind: 'voice', event: { type: 'final', text: 'what do you know' } },
    { kind: 'voice', event: { type: 'listening', on: false } }, { kind: 'phase', phase: 'recalling', detail: '' });
  assert.equal(s.stage, 'thinking');
  assert.equal(s.heard, 'what do you know');
  assert.equal(s.detail, 'Querying your DKG…');
  s = talkReducer(s, { kind: 'reply', reply: 'You like tea.' });
  assert.equal(hideAfter(s), UNSPOKEN_REPLY_MS);
  s = talkReducer(s, { kind: 'phase', phase: 'done', detail: '' });
  assert.equal(s.stage, 'replied', 'a late phase never hides the reply');
  s = talkReducer(s, { kind: 'voice', event: { type: 'speech-start' } });
  assert.equal(s.stage, 'speaking');
  s = talkReducer(s, { kind: 'voice', event: { type: 'speech-end' } });
  assert.equal(s.stage, 'done');
  assert.equal(hideAfter(s), AFTER_SPEECH_MS);
  assert.equal(s.reply, 'You like tea.');
});

test('letting go with nothing heard ends the turn; a new press starts clean', () => {
  let s = run({ kind: 'voice', event: { type: 'listening', on: true } }, { kind: 'voice', event: { type: 'listening', on: false } });
  assert.equal(s.stage, 'done');
  assert.equal(hideAfter(s), NOTHING_HEARD_MS);
  s = run({ kind: 'reply', reply: 'old' }, { kind: 'voice', event: { type: 'listening', on: true } });
  assert.deepEqual(s, { ...INITIAL, stage: 'listening' });
  assert.deepEqual(talkReducer(s, { kind: 'reset' }), INITIAL);
});

test('an error is shown, then the window goes', () => {
  const s = run({ kind: 'voice', event: { type: 'listening', on: true } }, { kind: 'voice', event: { type: 'error', message: 'The microphone is not allowed.' } });
  assert.equal(s.error, 'The microphone is not allowed.');
  assert.ok((hideAfter(s) ?? 0) > 0);
});

test('phase lines prefer the core detail', () => {
  assert.equal(phaseLine('acting', 'Running Bash: ls'), 'Running Bash: ls');
  assert.equal(phaseLine('remembering', ' '), 'Writing to your memory…');
});
