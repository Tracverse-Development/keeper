// FIX-0006: in the collapsed rail the keeper button must not be wider than the rail's room, or
// its active fill sits off-centre from the badge. The rail's keeper rule drops padding and frame.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('./keepers.css', import.meta.url), 'utf8');

test('the collapsed rail draws the active look on the badge alone', () => {
  const rule = css.match(/\.keepers\.is-rail \.keeper \{([^}]*)\}/)?.[1] ?? '';
  assert.match(rule, /padding:\s*0/);
  assert.match(rule, /border:\s*0/);
  assert.match(rule, /width:\s*auto/);
  assert.match(css, /\.keepers\.is-rail \.keeper:hover, \.keepers\.is-rail \.keeper\.is-on \{[^}]*background:\s*transparent/);
});
