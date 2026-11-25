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
 * `onTouch` (e.g. so the assistant can say something). `skin` swaps the look live.
 *
 * `memoryPulse` is a counter: every increase sends one spark into the memory halo.
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import type { Character, HitRegion, Mood, TouchKind } from './contract';
import { createCharacter } from './create-character';
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
  /** Called once per touch gesture on the character, after its reaction started. */
  onTouch?: (kind: TouchKind, region: HitRegion) => void;
  className?: string;
}

const CANVAS_STYLE: CSSProperties = { display: 'block', width: '100%', height: '100%', touchAction: 'none' };

export function CharacterStage(props: CharacterStageProps) {
  const { skin = DEFAULT_SKIN_ID, mood, voiceLevel, mouth, memoryPulse, onTouch, className } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const characterRef = useRef<Character | null>(null);
  const lastPulse = useRef(memoryPulse);
  // The latest props, read once at mount so the new character starts in the right state.
  const initial = useRef({ skin, mood, voiceLevel, mouth });
  initial.current = { skin, mood, voiceLevel, mouth };
  const onTouchRef = useRef(onTouch);
  onTouchRef.current = onTouch;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let character: Character;
    try {
      character = createCharacter(canvas, { skin: initial.current.skin });
    } catch (error) {
      // No WebGL2 (or a lost GPU): the rest of the app keeps working without the face.
      if (import.meta.env.DEV) console.warn('[character] could not start WebGL', error);
      return;
    }
    characterRef.current = character;
    character.setMood(initial.current.mood);
    character.setVoiceLevel(initial.current.voiceLevel);
    character.setMouth(initial.current.mouth);

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
  useEffect(() => characterRef.current?.setMood(mood), [mood]);
  useEffect(() => characterRef.current?.setVoiceLevel(voiceLevel), [voiceLevel]);
  useEffect(() => characterRef.current?.setMouth(mouth), [mouth]);
  useEffect(() => {
    if (memoryPulse > lastPulse.current) characterRef.current?.pulseMemory();
    lastPulse.current = memoryPulse;
  }, [memoryPulse]);

  return <canvas ref={canvasRef} className={className} style={CANVAS_STYLE} aria-hidden="true" />;
}
