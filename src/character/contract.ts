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
  /**
   * How rare the item is (`common`, `uncommon`, `rare`, `legendary`, `mythical`): the core fills it
   * in from the item. It sets how grand the item's effect is (`parts/rarity.ts`); left out = common.
   */
  rarity?: string;
  /** The set this piece glows with while three of its set are worn together (the core fills it in). */
  set?: string;
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
 *   hum         - sways gently while little musical notes float up (a robot's habit)
 *   chase-tail  - a quick spin after its own tail (a dog's habit)
 *   scratch     - leans over and scratches an ear with a back leg (a dog's habit)
 */
export type Emote =
  | 'wave'
  | 'celebrate'
  | 'streak'
  | 'love'
  | 'surprised'
  | 'wink'
  | 'sleepy'
  | 'stretch'
  | 'look-around'
  | 'nod'
  | 'hum'
  | 'chase-tail'
  | 'scratch';

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

/**
 * The keeper's look: a colour (`#rrggbb`) and a material per PAINT ZONE of its body, mirroring
 * `KeeperProfile.look` in the core (`src-tauri/src/keepers/kit/look.rs`). Zones by species
 * (`LOOK_ZONES`): robot `head`, `face`, `eyes`, `body`, `core`, `antenna` (its gold ear rings);
 * puppy `head`, `ears`, `muzzle`, `eyes`, `body`, `legs`, `paws`, `tail`. Materials: `matte`,
 * `gloss`, `metal`, `fur`, `glow`. A zone left out keeps the species' own colour and material;
 * unknown zones, bad colours and unknown materials are ignored, e.g.
 *   { ears: { color: '#c0392b' }, body: { material: 'metal' }, eyes: { color: '#1fd2d6', material: 'glow' } }
 */
export type Look = Readonly<Record<string, { color?: string; material?: string }>>;

/**
 * The keeper's habits: what it does on its own when idle, as weights from 0 (never) to 3
 * (often), mirroring `KeeperProfile.habits` (`look.rs` HABITS). Ids: `sleep` (how soon a quiet
 * keeper dozes off and naps: eyes shut, the robot's screen dimmed, slow breathing, "z"s, until the
 * pointer moves, someone speaks or a turn starts), `stretch`, `look-around`, `wink`, `nod`, and the
 * species' own: `hum` (robot), `chase-tail` and `scratch` (puppy). A habit left out takes the
 * species' default; a habit the species does not have is ignored.
 */
export type Habits = Readonly<Record<string, number>>;

/** Where a camera should stand to frame one paint zone (the Studio's zoom onto a part). */
export interface ZoneFocus {
  /** The point to look at (world units, the character at rest). */
  readonly target: { readonly x: number; readonly y: number; readonly z: number };
  /** How far from `target` the camera stands. */
  readonly distance: number;
  /** Which side to look from: radians round the body, 0 = the front, positive = from screen right. */
  readonly yaw: number;
}

// The keeper's own look, habits and the Studio's camera (appended by declaration merging).
export interface Character {
  /** Repaint the paint zones live (`Look`); no rebuild, no transition; an equal look does nothing. */
  setLook(look: Look): void;
  /** Change what the keeper does when idle and how soon it naps (`Habits`). */
  setHabits(habits: Habits): void;
  /** Where to frame paint zone `zone` on the current body, or null when the body has no such zone. */
  zoneFocus(zone: string): ZoneFocus | null;
  /**
   * Glide the character's own camera onto paint zone `zone` (eased, about a second), or back to
   * the whole character with null (an unknown zone also goes back). A species swap re-aims at the
   * new body's zone of the same name.
   */
  focusZone(zone: string | null): void;
}

/**
 * The keeper's simulated mood as the body shows it (the core's `feelings` PAD point): `pleasure`
 * and `arousal`, each -1..1. Glad lifts the smile and the light; low pleasure only quiets them
 * (never a frown at the person). High arousal breathes and blinks faster; low arousal slows the
 * breath and lowers the lids. `null` (or 0, 0) = exactly the look it has with no mood.
 */
export interface Feeling {
  readonly pleasure: number;
  readonly arousal: number;
}

// Being picked up (appended by declaration merging).
export interface Character {
  /**
   * The person picked the character up and holds it `offset` away from where they grabbed it
   * (-1..1 of the stage each way, y up), or let it go (null). Carried, it lifts, dangles against
   * the pull and looks surprised; let go, it settles back by itself. The stage's own gestures
   * call this (a still press on the character, then a move).
   */
  carry(offset: { x: number; y: number } | null): void;
}

// A picture of the character (appended by declaration merging).
export interface Character {
  /**
   * The character as it looks this instant: one frame is drawn and the canvas is returned as a
   * PNG data URL (its own size, the stage's backdrop included). Null when it cannot be read
   * (disposed, or the browser refuses). For a keeper card, never for anything automatic.
   */
  snapshot(): string | null;
}

// The stage's light (appended by declaration merging).
/**
 * A stage mood (`stage/stage-moods.ts`): how the light and the sky look. `night` is the stage as it
 * always was; `neon` (teal and magenta), `lamplight` (warm), `dawn`, `starfield` and `celestial`
 * (gold) light the character with real coloured lights.
 */
export type StageMood = 'night' | 'neon' | 'lamplight' | 'dawn' | 'starfield' | 'celestial';

export interface Character {
  /**
   * Light the stage in a mood, eased over about a second (at once under reduced motion). `auto` (the
   * default) follows what is worn: a set glowing (three of its pieces on) brings its own mood, and
   * nothing glowing is `night`.
   */
  setStageMood(mood: StageMood | 'auto'): void;
}

// The mood in the body (appended by declaration merging).
export interface Character {
  /** Show this mood in the body, eased over a couple of seconds; null = no mood. */
  setFeeling(feeling: Feeling | null): void;
}

/*
 * Moment effects (thinking, celebrate) arrive as WEARABLES, like any part: a `WornPart` whose part
 * is a moment effect (`PARTS` rows in slot `thinking` or `celebrate`: think-classic, think-pulse,
 * think-orbit, think-nebula, think-vortex; cheer-confetti, cheer-fireworks, cheer-starburst), with
 * effects `{ color: '#rrggbb', intensity: 0.25..2 }`, e.g.
 *   setWearables([{ part: 'memory-halo' }, { part: 'think-vortex', effects: { color: '#c25cf0' } }])
 * The worn thinking effect plays whenever the mood is `thinking`; the worn celebrate effect bursts
 * at the moment `emote('celebrate')` or `emote('streak')` takes off. None worn = the classic
 * thinking and the shipped celebration.
 */

// Turning round to see the back (appended by declaration merging): the Studio's back view.
export interface Character {
  /**
   * Walk the camera round the keeper: `drag` follows a drag by `delta` radians (positive = the
   * keeper turns to show its right side) at `time` seconds (any steady clock, e.g.
   * `performance.now() / 1000`); `release` lets go, and it coasts and slows; `to` glides to an angle
   * (0 = the front, π = the back); `by` glides on by a step (the arrow keys); `around` shows the back, or the front again. Left alone a few
   * seconds, it glides back to the front by itself. The zone focus keeps working while turned.
   */
  turn(command: TurnCommand): void;
}

export type TurnCommand =
  | { readonly kind: 'drag'; readonly delta: number; readonly time: number }
  | { readonly kind: 'release'; readonly time: number }
  | { readonly kind: 'to'; readonly yaw: number }
  | { readonly kind: 'by'; readonly delta: number }
  | { readonly kind: 'around' };

// The face it wears (appended by declaration merging).
/**
 * One of the four expressions every keeper draws its own way (`expression-mix.ts`): `happy`, `focused`,
 * `sleepy`, `surprised`; `neutral` shows none of them and `auto` (the default) follows what it is doing
 * (a pat or a happy mood smiles, thinking and hard work focus, a doze or a tired mood is sleepy, a poke
 * surprises) and the stage it stands on (the starfield leans sleepy, neon alert, lamplight warm).
 */
export type Expression = 'happy' | 'focused' | 'sleepy' | 'surprised' | 'neutral' | 'auto';

export interface Character {
  /**
   * Hold one expression (eased in, never snapped), or `auto` to follow what it does again. Unknown
   * values are ignored. Moods, emotes, blinks and the gaze keep playing on top, e.g.
   *   character.setExpression('sleepy')   // a preview of the sleepy face
   */
  setExpression(expression: Expression): void;
}
