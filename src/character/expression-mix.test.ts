/**
 * Tests for the face mix: which expression shows when, how it eases, how it folds (pure).
 * Run: node --test --experimental-strip-types src/character/expression-mix.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Mood, StageMood } from './contract';
import { restingExpression, type ExpressionFrame } from './expression-frame.ts';
import {
  alreadyShown,
  easeMix,
  FACE_EXPRESSIONS,
  foldMix,
  isExpressionChoice,
  restingMix,
  selectExpression,
  STAGE_LEAN,
  type ExpressionChoice,
  type FaceExpression,
  type FaceMix,
  type MixInputs,
} from './expression-mix.ts';
import { MOOD_NAMES, moodTarget } from './moods.ts';

function weights(mood: Mood): Record<Mood, number> {
  return Object.fromEntries(MOOD_NAMES.map((m) => [m, m === mood ? 1 : 0])) as Record<Mood, number>;
}

function inputs(over: Partial<Omit<MixInputs, 'emote'>> & { mood?: Mood; emote?: Partial<ExpressionFrame> } = {}): MixInputs {
  return {
    weights: over.weights ?? weights(over.mood ?? 'idle'),
    work: over.work ?? 0,
    feeling: over.feeling ?? { pleasure: 0, arousal: 0 },
    touch: over.touch ?? { poke: 0, pat: 0 },
    emote: { ...restingExpression(), ...over.emote },
    stage: over.stage ?? 'night',
    forced: over.forced ?? null,
  };
}

/** The expression that shows most, or null when nothing shows. */
function strongest(mix: FaceMix): FaceExpression | null {
  let best: FaceExpression | null = null;
  for (const key of FACE_EXPRESSIONS) if (mix[key] > 0.05 && (!best || mix[key] > mix[best])) best = key;
  return best;
}

test('mix: an idle keeper on the default night stage shows its plain face', () => {
  assert.deepEqual(selectExpression(inputs()), restingMix());
});

test('mix: what it does picks the face', () => {
  assert.equal(strongest(selectExpression(inputs({ mood: 'happy' }))), 'happy');
  assert.equal(strongest(selectExpression(inputs({ touch: { poke: 0, pat: 1 } }))), 'happy');
  assert.equal(strongest(selectExpression(inputs({ mood: 'thinking' }))), 'focused');
  assert.equal(strongest(selectExpression(inputs({ work: 0.9 }))), 'focused');
  assert.equal(strongest(selectExpression(inputs({ mood: 'asleep' }))), 'sleepy');
  assert.equal(strongest(selectExpression(inputs({ emote: { sleepy: 0.75 } }))), 'sleepy', 'drowsing');
  assert.equal(strongest(selectExpression(inputs({ feeling: { pleasure: 0, arousal: -1 } }))), 'sleepy', 'tired');
  assert.equal(strongest(selectExpression(inputs({ feeling: { pleasure: 1, arousal: 0 } }))), 'happy', 'glad');
  assert.equal(strongest(selectExpression(inputs({ touch: { poke: 1, pat: 0 } }))), 'surprised');
  assert.equal(strongest(selectExpression(inputs({ emote: { wide: 0.8 } }))), 'surprised', 'carried');
  assert.equal(strongest(selectExpression(inputs({ work: 0.1 }))), null, 'light work shows nothing');
});

test('mix: a surprise wipes the rest, focus keeps sleep away, a pat keeps sleep shallow', () => {
  const poked = selectExpression(inputs({ mood: 'thinking', touch: { poke: 1, pat: 0 }, emote: { sleepy: 0.7 } }));
  assert.equal(poked.surprised, 1);
  assert.equal(poked.focused, 0);
  assert.equal(poked.sleepy, 0);
  const working = selectExpression(inputs({ work: 1, emote: { sleepy: 0.75 } }));
  assert.ok(working.sleepy < 0.2 * working.focused, `sleepy ${working.sleepy} under focused ${working.focused}`);
  const patted = selectExpression(inputs({ touch: { poke: 0, pat: 1 }, emote: { sleepy: 0.75 } }));
  assert.ok(patted.happy > patted.sleepy);
});

test('mix: the stage leans the idle face (starfield sleepy, neon focused, lamplight happy)', () => {
  assert.equal(strongest(selectExpression(inputs({ stage: 'starfield' }))), 'sleepy');
  assert.equal(strongest(selectExpression(inputs({ stage: 'neon' }))), 'focused');
  assert.equal(strongest(selectExpression(inputs({ stage: 'lamplight' }))), 'happy');
  assert.equal(strongest(selectExpression(inputs({ stage: 'celestial' }))), 'happy');
  // A doze is deeper under the stars than at neon, and night deepens it over dawn.
  const doze = (stage: StageMood): number => selectExpression(inputs({ stage, emote: { sleepy: 0.6 } })).sleepy;
  assert.ok(doze('starfield') > doze('night'));
  assert.ok(doze('night') > doze('dawn'));
  assert.ok(doze('dawn') > doze('neon'));
  // The resting lean never shows while it works or sleeps (only the gain does).
  assert.equal(selectExpression(inputs({ stage: 'lamplight', mood: 'thinking' })).happy, 0);
  for (const stage of Object.keys(STAGE_LEAN) as StageMood[]) {
    const mix = selectExpression(inputs({ stage, mood: 'happy', touch: { poke: 1, pat: 1 }, work: 1, emote: { sleepy: 1 } }));
    for (const key of FACE_EXPRESSIONS) assert.ok(mix[key] >= 0 && mix[key] <= 1, `${stage} ${key} ${mix[key]}`);
  }
});

test('mix: a forced expression shows alone; neutral shows none; auto is the selection', () => {
  for (const key of FACE_EXPRESSIONS) {
    const mix = selectExpression(inputs({ forced: key, mood: 'thinking', touch: { poke: 1, pat: 0 } }));
    for (const other of FACE_EXPRESSIONS) assert.equal(mix[other], other === key ? 1 : 0);
  }
  assert.deepEqual(selectExpression(inputs({ forced: 'neutral', mood: 'happy' })), restingMix());
  assert.deepEqual(selectExpression(inputs({ forced: 'auto', mood: 'happy' })), selectExpression(inputs({ mood: 'happy' })));
  const choices: unknown[] = ['auto', 'neutral', ...FACE_EXPRESSIONS];
  for (const c of choices) assert.ok(isExpressionChoice(c));
  for (const bad of ['angry', '', null, 3, undefined]) assert.equal(isExpressionChoice(bad), false);
  const typed: ExpressionChoice = 'focused';
  assert.ok(isExpressionChoice(typed));
});

test('mix: easing glides (no jump in one frame), a surprise snaps in faster than sleep', () => {
  const target: FaceMix = { happy: 1, focused: 1, sleepy: 1, surprised: 1 };
  const mix = easeMix(restingMix(), target, 1 / 60);
  for (const key of FACE_EXPRESSIONS) assert.ok(mix[key] > 0 && mix[key] < 0.3, `${key} ${mix[key]}`);
  assert.ok(mix.surprised > mix.sleepy);
  // Frame-rate independent: 60 small steps land where one second's worth of steps do at 30 fps.
  const a = restingMix();
  const b = restingMix();
  for (let i = 0; i < 60; i++) easeMix(a, target, 1 / 60);
  for (let i = 0; i < 30; i++) easeMix(b, target, 1 / 30);
  for (const key of FACE_EXPRESSIONS) assert.ok(Math.abs(a[key] - b[key]) < 1e-9);
  assert.deepEqual(easeMix(restingMix(), target, 0), restingMix(), 'no time, no change');
});

test('mix: a zero mix folds nothing; a full mix moves the shared dials the right way', () => {
  for (const mood of MOOD_NAMES) assert.deepEqual(foldMix(moodTarget(mood), restingMix(), restingMix()), moodTarget(mood));
  const idle = moodTarget('idle');
  const one = (key: FaceExpression): FaceMix => ({ ...restingMix(), [key]: 1 });
  const happy = foldMix(moodTarget('idle'), one('happy'), restingMix());
  assert.ok(happy.smile > idle.smile && happy.squint > idle.squint);
  const focused = foldMix(moodTarget('idle'), one('focused'), restingMix());
  assert.ok(focused.eyeOpen < idle.eyeOpen && focused.smile < idle.smile);
  const sleepy = foldMix(moodTarget('idle'), one('sleepy'), restingMix());
  assert.ok(sleepy.eyeOpen < focused.eyeOpen && sleepy.glow < idle.glow);
  const surprised = foldMix(moodTarget('idle'), one('surprised'), restingMix());
  assert.ok(surprised.eyeOpen > idle.eyeOpen && surprised.smile === 0);
});

test('mix: what another layer already shows is not folded twice', () => {
  const drowsy = inputs({ emote: { sleepy: 0.75 } });
  const mix = selectExpression(drowsy);
  const shown = alreadyShown(drowsy);
  // Night's gain deepens the doze a little past what the emote layer showed: only that is added.
  const before = moodTarget('idle');
  const after = foldMix(moodTarget('idle'), mix, shown);
  assert.ok(after.eyeOpen < before.eyeOpen);
  assert.ok(after.eyeOpen > 0.85, `only the night's extra: ${after.eyeOpen}`);
  const happyMood = inputs({ mood: 'happy' });
  assert.deepEqual(foldMix(moodTarget('happy'), selectExpression(happyMood), alreadyShown(happyMood)), moodTarget('happy'));
});
