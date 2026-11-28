/**
 * Tests for the look (paint zones and materials) and the moment effects as data (pure).
 * Run: node --test --experimental-strip-types src/character/look/zones.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKINS } from '../skins/catalog.ts';
import { LOOK_ZONES, MATERIALS, lookKey, resolveLook, zonesOf } from './zones.ts';
import { CHEER_STYLES, THINK_STYLES, cheerMoment, scaled, thinkingMoment } from '../effects/moments.ts';
import { PARTS, resolveWearables } from '../parts/catalog.ts';

test('every species has paint zones, and only the zones it has resolve', () => {
  for (const skin of SKINS) assert.ok(zonesOf(skin.id).length >= 6, skin.id);
  const look = resolveLook(
    {
      ears: { color: '#C0392B', material: 'fur' },
      antenna: { color: '#ffffff' },
      body: { material: 'metal' },
      tail: { color: 'red', material: 'lava' },
      eyes: { color: '#1fd2d6', material: 'glow' },
      __proto__: { head: { color: '#000000' } },
    },
    'puppy',
  );
  assert.deepEqual(look, { ears: { color: 0xc0392b, material: 'fur' }, body: { material: 'metal' }, eyes: { color: 0x1fd2d6, material: 'glow' } });
  assert.deepEqual(resolveLook({ antenna: { color: '#ffffff' } }, 'robot'), { antenna: { color: 0xffffff } });
  assert.deepEqual(resolveLook('nope', 'robot'), {});
  assert.deepEqual(resolveLook({ head: { color: '#123456' } }, 'dragon'), {});
  assert.equal(MATERIALS.length, 6);
});

test('equal looks give equal keys, whatever the order', () => {
  const a = resolveLook({ ears: { color: '#aa0000' }, tail: { material: 'gloss' } }, 'puppy');
  const b = resolveLook({ tail: { material: 'gloss' }, ears: { color: '#AA0000' } }, 'puppy');
  assert.equal(lookKey(a), lookKey(b));
  assert.notEqual(lookKey(a), lookKey(resolveLook({ ears: { color: '#aa0001' } }, 'puppy')));
  assert.deepEqual(Object.keys(LOOK_ZONES).sort(), SKINS.map((s) => s.id).sort());
});

test('moment effects: none worn is classic; the shipped colour keeps the shipped palette', () => {
  assert.equal(thinkingMoment(undefined).style, THINK_STYLES['think-classic']);
  assert.equal(thinkingMoment(undefined).colour, null);
  assert.equal(cheerMoment(undefined), null, 'no celebrate effect: the shipped cues play');
  const worn = resolveWearables([{ part: 'think-vortex', effects: { color: '#00ff88', intensity: 9 } }, { part: 'cheer-fireworks' }], 'puppy');
  const vortex = thinkingMoment(worn.thinking);
  assert.equal(vortex.style.dramaFloor, 1, 'the vortex always thinks at full drama');
  assert.equal(vortex.colour, 0x00ff88);
  assert.equal(vortex.intensity, 2);
  const classic = thinkingMoment(resolveWearables([{ part: 'think-classic' }], 'robot').thinking);
  assert.equal(classic.colour, null, 'the classic effect at its default colour is the shipped look');
  assert.equal(cheerMoment(worn.celebrate)?.style, CHEER_STYLES['cheer-fireworks']);
});

test('the styles climb with rarity: more is drawn the rarer the effect', () => {
  const amount = (id: keyof typeof THINK_STYLES): number => {
    const s = THINK_STYLES[id];
    return s.pulse + s.orbit + s.cloud + s.funnel + 100 * s.dramaFloor;
  };
  const order = ['think-classic', 'think-pulse', 'think-orbit', 'think-nebula', 'think-vortex'] as const;
  for (let i = 1; i < order.length; i++) assert.ok(amount(order[i]) > amount(order[i - 1]), order[i]);
  assert.ok(CHEER_STYLES['cheer-starburst'].flare && !CHEER_STYLES['cheer-fireworks'].flare);
  for (const id of Object.keys(THINK_STYLES)) assert.ok(PARTS.some((p) => p.id === id && p.slot === 'thinking'), id);
  for (const id of Object.keys(CHEER_STYLES)) assert.ok(PARTS.some((p) => p.id === id && p.slot === 'celebrate'), id);
  assert.equal(scaled(0, 2), 0);
  assert.equal(scaled(10, 0.25), 3);
});
