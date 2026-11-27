/**
 * Tests for the moment styles: every moment part has a style, the shipped ones are unchanged, the
 * newer ones draw what their names say, and the aura's buffer holds every style at full intensity.
 * Run: node --test --experimental-strip-types src/character/effects/moments.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOMENT_PARTS } from '../parts/moment-catalog.ts';
import { EFFECT_KINDS } from './particle-kinds.ts';
import { AURA_CAPACITY, CHEER_STYLES, THINK_STYLES, auraPoints } from './moments.ts';

test('every moment part has its own style (none falls back to the classic look)', () => {
  for (const part of MOMENT_PARTS) {
    const styles: Record<string, unknown> = part.slot === 'thinking' ? THINK_STYLES : CHEER_STYLES;
    assert.ok(styles[part.id], `${part.id} has a style`);
  }
  assert.equal(Object.keys(THINK_STYLES).length + Object.keys(CHEER_STYLES).length, MOMENT_PARTS.length, 'no style without a part');
});

test('the shipped styles are exactly as they shipped', () => {
  const t = THINK_STYLES['think-classic'];
  assert.deepEqual([t.dramaFloor, t.motes, t.pulse, t.orbit, t.cloud, t.funnel, t.comet, t.beacon, t.bars, t.compass, t.zzz, t.stars, t.pages], [0, 1, 0, 0, 0, 0, 0, 0, 0, false, 0, 0, 0]);
  assert.equal(auraPoints(t, 2), 0, 'classic thinking draws no aura');
  const v = THINK_STYLES['think-vortex'];
  assert.deepEqual([v.pulse, v.orbit, v.orbitRadius, v.cloud, v.funnel], [30, 14, 1.6, 60, 150]);
  const c = CHEER_STYLES['cheer-confetti'];
  assert.equal(c.confetti, 56);
  assert.ok(!c.embers && !c.petals && !c.balls && !c.ripples && !c.notes && !c.rainbow && !c.shootingStar);
  assert.equal(CHEER_STYLES['cheer-starburst'].rays, 70);
});

test('each newer moment draws what its name says', () => {
  assert.ok(THINK_STYLES['think-comet'].comet > 0);
  assert.ok(THINK_STYLES['think-beacon'].beacon > 0);
  assert.ok(THINK_STYLES['think-dream'].zzz > 0 && THINK_STYLES['think-dream'].stars > 0);
  assert.ok(THINK_STYLES['think-wave'].bars > 0);
  assert.ok(THINK_STYLES['think-compass'].compass);
  assert.ok(THINK_STYLES['think-pages'].pages > 0);
  assert.ok(CHEER_STYLES['cheer-sparks'].embers > 0);
  assert.ok(CHEER_STYLES['cheer-petals'].petals > 0);
  assert.ok(CHEER_STYLES['cheer-balls'].balls > 0);
  assert.ok(CHEER_STYLES['cheer-ripple'].ripples > 0 && CHEER_STYLES['cheer-ripple'].notes > 0);
  assert.ok(CHEER_STYLES['cheer-rainbow'].rainbow);
  assert.ok(CHEER_STYLES['cheer-shooting-star'].shootingStar);
});

test('the aura buffer holds every style at full intensity, and bursts fit their pools', () => {
  for (const [id, style] of Object.entries(THINK_STYLES)) assert.ok(auraPoints(style, 2) <= AURA_CAPACITY, id);
  // A burst bigger than its pool recycles its own first particles: keep every style inside.
  for (const [id, s] of Object.entries(CHEER_STYLES)) {
    for (const [kind, count] of [['ember', s.embers], ['petal', s.petals], ['ball', s.balls], ['ring', s.ripples], ['note', s.notes]] as const) {
      assert.ok(count * 2 <= EFFECT_KINDS[kind].capacity, `${id}: ${kind} at intensity 2`);
    }
  }
  assert.ok(7 * 18 <= EFFECT_KINDS.band.capacity, 'the rainbow fits the band pool');
  assert.ok(30 <= EFFECT_KINDS.glow.capacity, "the shooting star's trail fits the glow pool");
});
