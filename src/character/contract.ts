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

/**
 * A one-off expression the character can be asked to play (`Character.emote`):
 *   wave        - a hello: sways side to side with happy eyes (the puppy lifts a paw and waves);
 *                 also plays by itself when the window opens
 *   celebrate   - anticipation crouch, a stretched jump, a squashed landing; sparkle eyes and sparkles
 *   streak      - a bigger celebration with a spin and confetti (a quiz streak)
 *   love        - heart eyes on the robot's screen, a happy lean, little hearts floating up
 *   surprised   - a jolt up, wide eyes, an "o" mouth and a puff
 *   wink        - one eye closes for a beat with a tilt and a glint
 *   sleepy      - a slow yawn with heavy lids and a few drifting "z"s
 *   stretch     - stretches tall with content eyes, then settles
 *   look-around - glances left and right (the pointer still wins the moment it moves)
 *   nod         - a quick "yes" nod
 */
export type Emote = 'wave' | 'celebrate' | 'streak' | 'love' | 'surprised' | 'wink' | 'sleepy' | 'stretch' | 'look-around' | 'nod';

// Appended to the interface above by declaration merging (the contract grows by appending).
export interface Character {
  /**
   * Play an emote now (`Emote`; unknown names are ignored). It plays on top of the mood and
   * blends back out by itself; a new emote replaces one that is playing. The character also
   * emotes on its own: a hello wave when it starts, idle stretches and glances, and after a
   * long quiet spell it grows drowsy (heavy lids, drifting "z"s) until the pointer moves or
   * anything happens. Use it for events, e.g.
   *   character.emote('celebrate')   // a task finished
   *   character.emote('streak')      // a quiz streak
   *   character.emote('love')        // thanked
   *   character.emote('surprised')   // an error or an unexpected result
   * With `prefers-reduced-motion` the emote still plays, smaller and with fewer particles.
   */
  emote(name: Emote): void;
}
