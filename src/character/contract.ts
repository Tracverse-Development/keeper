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

/**
 * One wearable to put on: a part id from `PARTS` plus optional effect values (a variant).
 * Effects are data: unknown keys are ignored and values are clamped to the part's schema,
 * so `{ part: 'memory-halo', effects: { color: '#e2425f', spinWork: 3 } }` is a "Ruby Halo".
 */
export interface WornPart {
  part: string;
  effects?: Record<string, number | string>;
}

export interface Character {
  /** Change the mood; transitions are eased, never snapped. */
  setMood(mood: Mood): void;
  /** Microphone level 0..1 while listening (drives the halo and ear-glow). */
  setVoiceLevel(level: number): void;
  /** Mouth openness 0..1 while speaking; call on every spoken word boundary / tick. */
  setMouth(openness: number): void;
  /** Look toward a point in normalised screen space (-1..1, -1..1). */
  lookAt(x: number, y: number): void;
  /**
   * A pulse of light that travels from the character into the memory halo (a DKG write).
   * With no Memory Halo worn, nothing visible happens.
   */
  pulseMemory(): void;
  /**
   * Swap the look live (`SKINS` lists the ids; an unknown id falls back to the default
   * robot). The old skin shrinks away as the new one grows in, then the old is freed.
   */
  setSkin(id: string): void;
  /**
   * Put on these wearables (`PARTS` ids, one per slot; the first listed wins a slot). Eased:
   * a removed part shrinks out as its replacement grows in. Unknown parts and parts whose
   * species list excludes the current species are skipped; an equal list changes nothing.
   * `DEFAULT_WEARABLES` is the shipped look (Memory Halo + Ark Hull).
   */
  setWearables(parts: readonly WornPart[]): void;
  /**
   * How hard the keeper is working, 0 (idle) .. 1 (flat out, "overheating"): the turn's
   * phase blended with the computer's load. Eased in and out, applied on top of the mood
   * (thinking amplifies it). Values outside 0..1 are clamped; NaN is 0.
   */
  setWork(level: number): void;
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
