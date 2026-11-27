/**
 * Tests for the parts catalogue and wear-list resolution (pure data, no three.js).
 * Run: node --test --experimental-strip-types src/character/parts/catalog.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKINS } from '../skins/catalog.ts';
import { DEFAULT_WEARABLES, PARTS, SLOT_IDS, findPart, fitsSpecies, resolveWearables } from './catalog.ts';
import { RACES } from '../skins/races.ts';
import { resolveEffects } from './effects.ts';

test('the built-in parts: floating (halo, hull, aura), worn (jacket, scarf, cap, pack, a dog nail set and collar, spectacles, a robot visor, a watch and a lantern) and the moment effects', () => {
  assert.deepEqual(
    PARTS.map((part) => [part.id, part.slot]),
    [
      ['memory-halo', 'halo'],
      ['ark-hull', 'base'],
      ['star-aura', 'aura'],
      ['ark-jacket', 'torso'],
      ['knit-scarf', 'neck'],
      ['crew-cap', 'head'],
      ['trail-pack', 'back'],
      ['paw-nails', 'paws'],
      ['dog-collar', 'neck'],
      ['round-spectacles', 'face'],
      ['welder-visor', 'face'],
      ['trail-watch', 'wrist'],
      ['star-lantern', 'held'],
      ['think-classic', 'thinking'],
      ['think-pulse', 'thinking'],
      ['think-orbit', 'thinking'],
      ['think-nebula', 'thinking'],
      ['think-vortex', 'thinking'],
      ['cheer-confetti', 'celebrate'],
      ['cheer-fireworks', 'celebrate'],
      ['cheer-starburst', 'celebrate'],
    ],
  );
  assert.deepEqual(findPart('paw-nails')!.species, ['puppy']);
  assert.deepEqual(findPart('dog-collar')!.species, ['puppy']);
  for (const part of PARTS) if (part.slot === 'thinking' || part.slot === 'celebrate') assert.deepEqual(Object.keys(part.effects), ['color', 'intensity'], part.id);
  assert.deepEqual([...new Set(PARTS.map((p) => p.slot))].sort(), [...SLOT_IDS].sort(), 'every slot has a part');
});

test('every row is well formed: kebab id, name, known slot, species, effects schema', () => {
  const skinIds = SKINS.map((skin) => skin.id as string);
  const ids = new Set<string>();
  for (const part of PARTS) {
    assert.match(part.id, /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    assert.ok(!ids.has(part.id), `duplicate ${part.id}`);
    ids.add(part.id);
    assert.ok(part.name.trim().length > 0);
    assert.ok(part.description.length > 10 && part.description.length <= 120, `${part.id} description`);
    assert.ok((SLOT_IDS as readonly string[]).includes(part.slot));
    const species = part.species as 'any' | readonly string[];
    if (species !== 'any') for (const s of species) assert.ok(skinIds.includes(s) || RACES.some((r) => r.id === s), `${part.id} names unknown species or race ${s}`);
    assert.ok(Object.keys(part.effects).length > 0, `${part.id} has effects`);
    for (const [key, spec] of Object.entries(part.effects)) {
      assert.match(key, /^[a-z][a-zA-Z]*$/, `${part.id}.${key}`);
      if (spec.kind === 'number') {
        assert.ok(spec.min < spec.max, `${part.id}.${key} range`);
        assert.ok(spec.default >= spec.min && spec.default <= spec.max, `${part.id}.${key} default in range`);
      } else {
        assert.match(spec.default, /^#[0-9a-f]{6}$/, `${part.id}.${key} colour default`);
      }
    }
  }
});

test('the effects named in the brief exist', () => {
  assert.deepEqual(Object.keys(findPart('memory-halo')!.effects), ['color', 'spinIdle', 'spinWork', 'nodes']);
  assert.deepEqual(Object.keys(findPart('ark-hull')!.effects), ['color', 'rock']);
  assert.deepEqual(Object.keys(findPart('star-aura')!.effects), ['color', 'count', 'speed']);
  assert.deepEqual(Object.keys(findPart('ark-jacket')!.effects), ['color', 'trim', 'sway']);
  assert.deepEqual(Object.keys(findPart('knit-scarf')!.effects), ['color', 'stripe', 'sway']);
  assert.deepEqual(Object.keys(findPart('crew-cap')!.effects), ['color', 'trim']);
  assert.deepEqual(Object.keys(findPart('trail-pack')!.effects), ['color', 'trim', 'sway']);
});

test('the new wearables default to brand colours (tokens.css)', () => {
  const brand = new Set(['#151c33', '#1e2848', '#2a3760', '#d39744', '#e3b06a', '#f0c98a', '#b57b2c', '#f4eee2', '#fbf8f2']);
  for (const id of ['ark-jacket', 'knit-scarf', 'crew-cap', 'trail-pack']) {
    for (const [key, spec] of Object.entries(findPart(id)!.effects)) if (spec.kind === 'colour') assert.ok(brand.has(spec.default), `${id}.${key}`);
  }
});

test('DEFAULT_WEARABLES is the shipped look: Memory Halo and Ark Hull, no effects', () => {
  assert.deepEqual(DEFAULT_WEARABLES, [{ part: 'memory-halo' }, { part: 'ark-hull' }]);
});

test('resolveWearables: one per slot (first wins), unknown parts skipped, effects clamped', () => {
  const worn = resolveWearables(
    [
      { part: 'memory-halo', effects: { color: '#e2425f', spinWork: 3, bogus: 1 } },
      { part: 'memory-halo', effects: { color: '#00ff00' } },
      { part: 'dragon-wings' },
      null,
      42,
      { part: 'star-aura', effects: { count: 9999 } },
    ],
    'puppy',
  );
  assert.deepEqual(Object.keys(worn).sort(), ['aura', 'halo']);
  assert.equal(worn.halo?.effects.color, '#e2425f');
  assert.equal(worn.halo?.effects.spinWork, 3);
  assert.equal('bogus' in (worn.halo?.effects ?? {}), false);
  assert.equal(worn.aura?.effects.count, 120);
  assert.deepEqual(resolveWearables('nope', 'robot'), {});
  assert.deepEqual(resolveWearables([], 'robot'), {});
});

test('a variant is data: the Ruby Halo resolves against the halo schema', () => {
  const ruby = resolveWearables([{ part: 'memory-halo', effects: { color: '#e2425f', spinWork: 3 } }], 'robot').halo!;
  assert.deepEqual(ruby.effects, resolveEffects(findPart('memory-halo')!.effects, { color: '#e2425f', spinWork: 3 }));
  const plain = resolveWearables([{ part: 'memory-halo' }], 'robot').halo!;
  assert.notEqual(ruby.key, plain.key, 'a variant swaps; the same content keeps its key');
  assert.equal(plain.key, resolveWearables([{ part: 'memory-halo', effects: {} }], 'robot').halo!.key);
});

test('species fit: "any" fits every species; a listed part only its own', () => {
  const halo = findPart('memory-halo')!;
  assert.equal(fitsSpecies(halo, 'robot'), true);
  assert.equal(fitsSpecies(halo, 'puppy'), true);
  const robotOnly = { ...halo, species: ['robot'] as const };
  assert.equal(fitsSpecies(robotOnly, 'robot'), true);
  assert.equal(fitsSpecies(robotOnly, 'puppy'), false);
});

test('races decide who wears what, and the God Keeper wears everything (mirrors species::may_wear)', () => {
  const watch = findPart('trail-watch')!;
  assert.ok(fitsSpecies(watch, 'man') && fitsSpecies(watch, 'woman'), 'a human piece fits the man and the woman');
  for (const body of ['robot', 'puppy', 'owl']) assert.ok(!fitsSpecies(watch, body), `a human piece never fits the ${body}`);
  assert.ok(!fitsSpecies(findPart('welder-visor')!, 'man') && fitsSpecies(findPart('welder-visor')!, 'robot'));
  assert.ok(!fitsSpecies(findPart('dog-collar')!, 'owl'), "a dog's collar is not an owl's");
  for (const part of PARTS) assert.ok(fitsSpecies(part, 'god'), `the God Keeper wears ${part.id}`);
  assert.ok(!fitsSpecies(watch, 'dragon'), 'an unknown body fits only items for everyone');
});

test('a worn item carries its rarity; anything unknown is common', () => {
  const worn = resolveWearables([{ part: 'trail-watch', rarity: 'mythical' }, { part: 'crew-cap', rarity: 'shiny' }, { part: 'knit-scarf' }], 'man');
  assert.equal(worn.wrist?.rarity, 'mythical');
  assert.equal(worn.head?.rarity, 'common');
  assert.equal(worn.neck?.rarity, 'common');
  assert.notEqual(resolveWearables([{ part: 'trail-watch', rarity: 'rare' }], 'man').wrist?.key, worn.wrist?.key, 'a new tier redraws the item');
});
