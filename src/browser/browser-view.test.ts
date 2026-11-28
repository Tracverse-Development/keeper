/** Run: node --test --experimental-strip-types src/browser/browser-view.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostOf } from './browser-view.ts';

test('the toolbar names the site by its host', () => {
  assert.equal(hostOf('https://mail.google.com/mail/u/0/'), 'mail.google.com');
  assert.equal(hostOf('not a url'), '');
});
