import assert from 'node:assert/strict';
import { test } from 'node:test';

import { effectsIn, shownColour, swatchMove, swatchesOf, wornColour } from './colour-choice.ts';

const jacket = {
  id: 'official:ember-jacket',
  effects: { color: '#e2662c', trim: '#e3b06a', sway: 1.2 },
  colours: [
    { id: 'red', name: 'Red', effects: { color: '#b3262e', trim: '#f4eee2' } },
    { id: 'navy', name: 'Navy', effects: { color: '#151c33', trim: '#d39744' } },
  ],
};

test('a swatch row starts with the item’s own colours, then its palette; no palette, no row', () => {
  const row = swatchesOf(jacket);
  assert.deepEqual(row.map((s) => s.id), ['', 'red', 'navy']);
  assert.deepEqual(row[0], { id: '', name: 'Its own colours', fill: '#e2662c', edge: '#e3b06a' });
  assert.equal(row[2].edge, '#d39744');
  assert.deepEqual(swatchesOf({ effects: { color: '#ffffff' } }), [], 'an older core sends no colours');
  assert.deepEqual(swatchesOf({ effects: {}, colours: [] }), []);
});

test('the colour shown is the one just picked, else the one worn, and only from the palette', () => {
  const worn = [{ part: 'ark-jacket', item: 'official:ember-jacket', colour: 'navy' }];
  assert.equal(wornColour(worn, 'official:ember-jacket'), 'navy');
  assert.equal(wornColour([{ part: 'ark-jacket', item: 'official:ember-jacket' }], 'official:ember-jacket'), '', 'older data: its own colours');
  assert.equal(shownColour(jacket, {}, worn), 'navy');
  assert.equal(shownColour(jacket, { 'official:ember-jacket': 'red' }, worn), 'red');
  assert.equal(shownColour(jacket, { 'official:ember-jacket': '' }, worn), '', 'picking its own colours wins over the worn one');
  assert.equal(shownColour(jacket, { 'official:ember-jacket': 'crimson' }, []), '', 'not in the palette: its own');
});

test('effects in a colour lay the swatch over the design and keep the rest', () => {
  assert.deepEqual(effectsIn(jacket, 'red'), { color: '#b3262e', trim: '#f4eee2', sway: 1.2 });
  assert.deepEqual(effectsIn(jacket, ''), jacket.effects);
  assert.deepEqual(effectsIn(jacket, 'gold'), jacket.effects);
});

test('arrow keys move round the row, Home and End jump, other keys do not move', () => {
  assert.equal(swatchMove(0, 'ArrowRight', 3), 1);
  assert.equal(swatchMove(2, 'ArrowRight', 3), 0);
  assert.equal(swatchMove(0, 'ArrowLeft', 3), 2);
  assert.equal(swatchMove(1, 'Home', 3), 0);
  assert.equal(swatchMove(0, 'End', 3), 2);
  assert.equal(swatchMove(0, 'Enter', 3), null);
  assert.equal(swatchMove(0, 'ArrowRight', 0), null);
});
