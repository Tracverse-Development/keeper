/**
 * The character's public contract. Everything outside `src/character/` talks to the
 * character ONLY through this interface (and `index.ts`), never its internals.
 *
 * Moods are the assistant's state machine as the person sees it:
 *   idle      - breathing, slow look-around, occasional blink
 *   listening - leans in, eyes widen, halo reacts to the microphone level
 *   thinking  - looks up and aside, halo orbits faster (it is querying the DKG)
 *   speaking  - mouth moves with the words, gentle nods
 *   happy     - a short smile/bounce after something was remembered or done
 *   asleep    - eyes closed, dim (setup not finished, or muted)
 */
export type Mood = 'idle' | 'listening' | 'thinking' | 'speaking' | 'happy' | 'asleep';

/**
 * A touch on the character: `poke` is a quick click (a surprised jolt, then it looks at
 * you); `pat` is a stroke back and forth (happy squint, leans into it, warm sparkles).
 */
export type TouchKind = 'poke' | 'pat';

/** The part of the character a touch landed on. */
export type HitRegion = 'head' | 'body';

export interface Character {
  /** Change the mood; transitions are eased, never snapped. */
  setMood(mood: Mood): void;
  /** Microphone level 0..1 while listening (drives the halo and ear-glow). */
  setVoiceLevel(level: number): void;
  /** Mouth openness 0..1 while speaking; call on every spoken word boundary / tick. */
  setMouth(openness: number): void;
  /** Look toward a point in normalised screen space (-1..1, -1..1). */
  lookAt(x: number, y: number): void;
  /** A pulse of light that travels from the character into the memory halo (a DKG write). */
  pulseMemory(): void;
  /**
   * Swap the look live (`SKINS` lists the ids; an unknown id falls back to the default
   * robot). The old skin shrinks away as the new one grows in, then the old is freed.
   */
  setSkin(id: string): void;
  /**
   * Which part of the character is under a point in normalised device coordinates
   * (-1..1 across the canvas, y up), or null when the point misses it.
   */
  hitTest(x: number, y: number): HitRegion | null;
  /** Play a touch reaction (the stage detects gestures and calls this itself). */
  react(kind: TouchKind): void;
  /** Stop rendering and free GPU resources. */
  dispose(): void;
}
