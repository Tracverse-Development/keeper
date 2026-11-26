/// <reference types="vite/client" />
/**
 * `<CharacterStage>`: the React face of the character module. It owns one full-size
 * `<canvas>`, creates the character on mount and disposes it on unmount, forwards prop
 * changes to the `Character` contract, and turns pointer movement anywhere over the
 * window into `lookAt`. Sizing and pixel ratio are followed by the character itself
 * (ResizeObserver on this canvas, ratio capped at 2), so resizing needs nothing here.
 *
 * Touch: a click on the character is a poke, a back-and-forth stroke is a pat
 * (`touch-gestures.ts`). The stage plays the reaction itself and reports it through
 * `onTouch` (e.g. so the assistant can say something). `skin` swaps the species live,
 * `wearables` swaps what it wears (compared by content, so a new array with the same parts
 * does nothing) and `work` (0..1) drives the working animations.
 *
 * `memoryPulse` is a counter: every increase sends one spark into the memory halo.
 *
 * The keeper's own body: `look` repaints its paint zones live, `habits` sets what it does when
 * idle (and how soon it naps), and the moment effects arrive inside `wearables` (a part in slot
 * `thinking` or `celebrate`). `focusZone` glides the camera onto a paint zone (null = the whole
 * character). All are optional and compared by content, so a parent that rebuilds them every
 * render causes nothing.
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import type { Character, Feeling, Habits, HitRegion, Look, Mood, TouchKind, WornPart, Emote } from './contract';
import { createCharacter } from './create-character';
import { DEFAULT_WEARABLES } from './parts';
import { DEFAULT_SKIN_ID } from './skins/catalog';
import { attachTouchGestures } from './touch-gestures';

export interface CharacterStageProps {
  /** Which look to wear (`SKINS` ids); changing it plays the swap. Default: the robot. */
  skin?: string;
  mood: Mood;
  /** Microphone level 0..1. */
  voiceLevel: number;
  /** Mouth openness 0..1. */
  mouth: number;
  /** Increments trigger `pulseMemory()`. */
  memoryPulse: number;
  /** A one-shot emote: each new `n` plays `name` once (`Character.emote`). */
  emote?: { name: Emote; n: number };
  /** What it wears (`PARTS` ids plus effect values). Default: `DEFAULT_WEARABLES`. */
  wearables?: readonly WornPart[];
  /** How hard it is working, 0..1 (turn phase blended with machine load). Default 0. */
  work?: number;
  /** Colour and material per paint zone (`Look`). Default: the species' own. */
  look?: Look;
  /** Habit weights 0..3 (`Habits`). Default: the species' own. */
  habits?: Habits;
  /** A paint zone to frame with the camera (`Character.focusZone`); null or absent = the whole character. */
  focusZone?: string | null;
  /** Its simulated mood for the body (`Feeling`); null or absent = none. Compared by content. */
  feeling?: Feeling | null;
  /** Called once per touch gesture on the character, after its reaction started. */
  onTouch?: (kind: TouchKind, region: HitRegion) => void;
  className?: string;
}

const NO_LOOK: Look = {};
const NO_HABITS: Habits = {};
const CANVAS_STYLE: CSSProperties = { display: 'block', width: '100%', height: '100%', touchAction: 'none' };

export function CharacterStage(props: CharacterStageProps) {
  const { skin = DEFAULT_SKIN_ID, mood, voiceLevel, mouth, memoryPulse, onTouch, className } = props;
  const { wearables = DEFAULT_WEARABLES, work = 0, look = NO_LOOK, habits = NO_HABITS, focusZone = null } = props;
  // Compared by content: a parent that rebuilds the array every render causes no swap.
  const wearKey = JSON.stringify(wearables);
  const lookKey = JSON.stringify(look);
  const habitsKey = JSON.stringify(habits);
  const feelingKey = JSON.stringify(props.feeling ?? null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const characterRef = useRef<Character | null>(null);
  const lastPulse = useRef(memoryPulse);
  const lastEmote = useRef(props.emote?.n ?? 0);
  // The latest props, read once at mount so the new character starts in the right state.
  const initial = useRef({ skin, mood, voiceLevel, mouth, wearables, work, look, habits, focusZone, feeling: props.feeling ?? null });
  initial.current = { skin, mood, voiceLevel, mouth, wearables, work, look, habits, focusZone, feeling: props.feeling ?? null };
  const onTouchRef = useRef(onTouch);
  onTouchRef.current = onTouch;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let character: Character;
    try {
      const { skin: firstSkin, wearables: firstWear, look: firstLook, habits: firstHabits } = initial.current;
      character = createCharacter(canvas, { skin: firstSkin, wearables: firstWear, look: firstLook, habits: firstHabits });
    } catch (error) {
      // No WebGL2 (or a lost GPU): the rest of the app keeps working without the face.
      if (import.meta.env.DEV) console.warn('[character] could not start WebGL', error);
      return;
    }
    characterRef.current = character;
    character.setMood(initial.current.mood);
    character.setVoiceLevel(initial.current.voiceLevel);
    character.setMouth(initial.current.mouth);
    character.setWork(initial.current.work);
    character.focusZone(initial.current.focusZone);
    character.setFeeling(initial.current.feeling);

    const onPointerMove = (event: PointerEvent): void => {
      const x = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      const y = 1 - (event.clientY / Math.max(window.innerHeight, 1)) * 2;
      character.lookAt(x, y);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    const detachTouch = attachTouchGestures(canvas, character, (kind, region) => onTouchRef.current?.(kind, region));
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      detachTouch();
      character.dispose();
      characterRef.current = null;
    };
  }, []);

  useEffect(() => characterRef.current?.setSkin(skin), [skin]);
  useEffect(() => characterRef.current?.setWearables(JSON.parse(wearKey) as WornPart[]), [wearKey]);
  useEffect(() => characterRef.current?.setWork(work), [work]);
  useEffect(() => characterRef.current?.setLook(JSON.parse(lookKey) as Look), [lookKey]);
  useEffect(() => characterRef.current?.setHabits(JSON.parse(habitsKey) as Habits), [habitsKey]);
  useEffect(() => characterRef.current?.focusZone(focusZone), [focusZone]);
  useEffect(() => characterRef.current?.setFeeling(JSON.parse(feelingKey) as Feeling | null), [feelingKey]);
  useEffect(() => characterRef.current?.setMood(mood), [mood]);
  useEffect(() => characterRef.current?.setVoiceLevel(voiceLevel), [voiceLevel]);
  useEffect(() => characterRef.current?.setMouth(mouth), [mouth]);
  useEffect(() => {
    if (memoryPulse > lastPulse.current) characterRef.current?.pulseMemory();
    lastPulse.current = memoryPulse;
  }, [memoryPulse]);

  useEffect(() => {
    const e = props.emote;
    if (e && e.n > lastEmote.current) characterRef.current?.emote(e.name);
    lastEmote.current = e?.n ?? lastEmote.current;
  }, [props.emote]);

  return <canvas ref={canvasRef} className={className} style={CANVAS_STYLE} aria-hidden="true" />;
}
