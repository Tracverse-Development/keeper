/**
 * The shapes the Rust core sends and takes (serde camelCase), one source for the window. Re-exported
 * by `ipc.ts`, so callers import from there; split out to keep the bridge file small.
 */
import type { KeeperVoice, RoleInfo, ZoneLook } from './ipc-studio';
import type { Panel } from './panel-spec';

/** An engine id from the core's catalogue (`brain/engines/mod.rs`): claude, codex, gemini, hermes, ollama, reflex. */
export type EngineId = string;
export type VoiceEngine = 'system' | 'elevenlabs';

/** One keeper: its own look, mind and domain, remembering in its own Context Graph. */
export interface WornPart {
  part: string;
  effects?: Record<string, number | string>;
  /** The wardrobe item it was put on from (`part:…`, `stock:…`, `kit:…`). */
  item?: string;
}

export interface KeeperProfile {
  id: string;
  name: string;
  /** Its body: a species id ("robot", "puppy"). */
  skin: string;
  /** Its job: a role id ("system", "companion"). */
  role: string;
  /** Its personality: a soul id. */
  soul: string;
  wearables: WornPart[];
  graphId: string;
  brain: EngineId;
  model: string;
  /** Colour and material per paint zone (`kit/look.rs`); absent = the species' own colours. */
  look?: Record<string, ZoneLook>;
  /** Idle habits, 0 (never) to 3 (often); absent = the species' defaults. */
  habits?: Record<string, number>;
  /** Its own voice; absent = the app-wide voice in Settings. */
  voice?: KeeperVoice;
  /** How it shows answers: balanced, explainer, brief, chat (absent = balanced). */
  style?: string;
  /** The person turned its simulated mood off. */
  feelingsOff?: boolean;
}

export interface KeeperList {
  keepers: KeeperProfile[];
  active: string;
  roles: RoleInfo[];
}

/** A soul: WHO a keeper is (personality). Built in, or the person's own (on the DKG). */
export interface Soul {
  id: string;
  name: string;
  summary: string;
  traits: string[];
  tone: string;
  humor: number;
  formality: number;
  emoji: boolean;
  catchphrases: string[];
  greeting: string;
  pokeLines: string[];
  patLines: string[];
  rules: string[];
  builtin: boolean;
}

export interface PartInfo {
  id: string;
  name: string;
  slot: string;
  species: string[];
  effects: { key: string; kind: 'number' | 'color'; min: number; max: number }[];
}

export interface Variant extends WornPart {
  id: string;
  name: string;
  oneOfAKind?: boolean;
}

export interface KitCatalog {
  species: { id: string; name: string; slots: string[] }[];
  parts: PartInfo[];
  roles: RoleInfo[];
  souls: Soul[];
  variants: Variant[];
}

export interface Imported {
  kind: 'soul' | 'variant' | 'keeper';
  name: string;
  keeper: string | null;
}

export interface SystemLoad {
  cpu: number;
  memory: number;
}

export interface KeeperSaved {
  list: KeeperList;
  announcement: string | null;
}

export type KeeperChange = Partial<Pick<KeeperProfile, 'name' | 'skin' | 'brain' | 'model' | 'role' | 'soul' | 'wearables' | 'look' | 'habits' | 'voice' | 'style'>> & {
  /** Turn the keeper's simulated mood off (or back on), in every mode. */
  feelingsOff?: boolean;
} & {
  /** True: go back to the app-wide voice. */
  appVoice?: boolean;
};

export interface Settings {
  setupComplete: boolean;
  nodeHome: string;
  keepers: KeeperProfile[];
  activeKeeper: string;
  agentActions: boolean;
  voice: string;
  voiceEngine: VoiceEngine;
  elevenVoiceId: string;
  alwaysListening: boolean;
  wakeWord: boolean;
  talkShortcut: string;
  /** Answer visually on the Stage by default. */
  visual: boolean;
  /** Prepare the next scenes (each card of a lesson) in the background. */
  prefetchScenes: boolean;
  /** The quick helper model for prepared scenes and panel follow-ups ("" = off). */
  fastModel: string;
  /** Show the plan and wait for Approve before acting on the computer. */
  askBeforeActing: boolean;
  /** Short conversational turns go to the quick helper model. */
  quickReplies: boolean;
  autoUpdate: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
}

export interface Chat {
  id: string;
  title: string;
  at: string;
}

export type QuestionParam = 'days' | 'category' | 'chat' | 'skill';

export interface QuestionInfo {
  id: string;
  title: string;
  group: string;
  params: QuestionParam[];
}

export interface Answer {
  trace: QueryTrace;
  rows: Record<string, string>[];
}

export interface FolderAccess {
  folder: string;
  granted: boolean;
}

export interface ShortcutStatus {
  shortcut: string;
  registered: boolean;
}

export interface EngineStatus {
  id: EngineId;
  label: string;
  blurb: string;
  place: 'device' | 'cloud';
  canAct: boolean;
  available: boolean;
  problem: string | null;
  models: ModelOption[];
}

export interface ElevenVoice {
  id: string;
  name: string;
}

export interface PhoneStatus {
  on: boolean;
  url: string;
  qr: string;
}

export interface UpdateStatus {
  current: string;
  installed: string | null;
}

export interface AgentStep {
  tool: string;
  detail: string;
}

export interface NodeStatus {
  name: string;
  version: string;
  networkName: string;
  peerId: string;
}

export interface FoundNode {
  home: string;
  port: number;
  status: NodeStatus;
}

export interface Scan {
  node: FoundNode | null;
  silentNodes: string[];
  ollamaModels: string[];
  hermesInstalled: boolean;
  voiceHelper: boolean;
  computerName: string;
}

export interface GraphReady {
  graphId: string;
  uri: string;
  profileUal: string;
  merkleRoot: string;
  verified: boolean;
  queryMs: number;
}

export interface Fact {
  id: string;
  text: string;
  category: string;
  at: string;
}

export interface Turn {
  id: string;
  said: string;
  replied: string;
  mind: string;
  at: string;
  chat: string;
  /** The Stage panels this turn showed (its scene). */
  panels?: Panel[];
  /** The mode it was in (a chat reopens in its mode). */
  mode?: string;
}

export interface ActionRecord {
  id: string;
  skill: string;
  input: string;
  outcome: string;
  succeeded: boolean;
  at: string;
}

export interface Reminder {
  id: string;
  text: string;
  dueAt: string;
  at: string;
}

export interface QueryTrace {
  label: string;
  sparql: string;
  rows: number;
  ms: number;
  layer: string;
}

export interface WriteReceipt {
  name: string;
  ual: string;
  status: string;
  queued: boolean;
}

export interface MindUsed {
  id: EngineId;
  label: string;
  local: boolean;
  fellBack: string | null;
}

export interface Outcome {
  skill: string;
  input: string;
  summary: string;
  succeeded: boolean;
}

export interface TurnResult {
  keeper: string;
  /** The mode that answered (it may have switched from the chat's mode). */
  mode?: string;
  /** True when this turn moved the chat to another mode. */
  switched?: boolean;
  chat: string;
  reply: string;
  mind: MindUsed;
  learned: Fact[];
  forgotten: Fact[];
  actions: Outcome[];
  /** What to show on the Stage (validated by the core). */
  panels: Panel[];
  steps: AgentStep[];
  traces: QueryTrace[];
  writes: WriteReceipt[];
  memoryOffline: boolean;
  /** How long the turn took (absent on turns rebuilt from history). */
  timings?: Timings;
}

/** One turn's timing in milliseconds (`assistant::Timings`). */
export interface Timings {
  recallMs: number;
  /** The person first saw something (the reply ready, or a panel). */
  firstMs: number | null;
  /** The first Stage panel arrived (absent or null when the answer has none). */
  panelMs?: number | null;
  thinkMs: number;
  totalMs: number;
  source: string;
}

export interface Counts {
  facts: number;
  turns: number;
  actions: number;
  reminders: number;
  waiting: number;
}

export interface Overview {
  graphId: string;
  node: NodeStatus | null;
  counts: Counts;
  facts: Fact[];
  turns: Turn[];
  actions: ActionRecord[];
  reminders: Reminder[];
  traces: QueryTrace[];
}

export type SettingsChange = Partial<Pick<Settings, 'agentActions' | 'voice' | 'voiceEngine' | 'elevenVoiceId' | 'alwaysListening' | 'wakeWord' | 'talkShortcut' | 'autoUpdate' | 'visual' | 'prefetchScenes' | 'fastModel' | 'askBeforeActing' | 'quickReplies'>>;

export type Phase = 'recalling' | 'thinking' | 'acting' | 'remembering' | 'done';

export type VoiceEvent =
  | { type: 'ready'; onDevice: boolean }
  | { type: 'level'; value: number }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'listening'; on: boolean; mode?: string }
  | { type: 'woken' }
  | { type: 'speech-start' }
  | { type: 'word'; length: number }
  | { type: 'mouth'; value: number }
  | { type: 'speech-end' }
  | { type: 'authorized'; speech: string; mic: boolean; onDevice: boolean }
  | { type: 'voices'; voices: { name: string; language: string; quality: number }[] }
  | { type: 'stopped' }
  | { type: 'error'; message: string };

/** What a panel action changed (`stage_action`). */
export interface ActionDone {
  /** Right quiz answers in a row, after a quiz answer. */
  streak: number;
}

/** Calendar and contacts on this Mac (`pim_access`). */
export type PimAccessState = 'allowed' | 'denied' | 'notasked' | 'unsupported';
export interface PimAccess {
  calendar: PimAccessState;
  contacts: PimAccessState;
}

/** A scene the person pinned (on the keeper's graph; `scenes_pinned`). */
export interface PinnedScene {
  id: string;
  title: string;
  panels: import('./panel-spec').Panel[];
  at: string;
}
