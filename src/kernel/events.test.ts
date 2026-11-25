// The window's event names and the core's (src-tauri/src/kernel/events.rs) are one list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('every core event name is mirrored in ipc.ts and nothing extra', () => {
  const rust = readFileSync(new URL('../../src-tauri/src/kernel/events.rs', import.meta.url), 'utf8');
  const ts = readFileSync(new URL('./ipc.ts', import.meta.url), 'utf8');
  const rustNames = [...rust.matchAll(/pub const \w+: &str = "([^"]+)"/g)].map((m) => m[1]).sort();
  const block = ts.slice(ts.indexOf('export const EVENTS'), ts.indexOf('} as const'));
  const tsNames = [...block.matchAll(/'([a-z]+:\/\/[a-z-]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(tsNames, rustNames);
});
