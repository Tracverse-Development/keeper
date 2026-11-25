/**
 * The window's ONE bridge to the Rust core: typed commands and events.
 * Shapes mirror `src-tauri/src` exactly (serde camelCase); event names mirror
 * `src-tauri/src/kernel/events.rs` (`events.test.ts` keeps the two lists equal).
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export const EVENTS = {
  assistantPhase: 'assistant://phase',
  assistantSays: 'assistant://says',
  voiceEvent: 'voice://event',
  voiceCommand: 'voice://command',
  setupProgress: 'setup://progress',
  memoryWritten: 'memory://written',
  phoneTurn: 'phone://turn',
  appUpdate: 'app://update',
} as const;

/** An engine id from the core's catalogue (`brain/engines/mod.rs`): claude, codex, gemini, hermes, ollama, reflex. */
export type EngineId = string;
export type VoiceEngine = 'system' | 'elevenlabs';

export interface Settings {
  setupComplete: boolean;
  assistantName: string;
  graphId: string;
  nodeHome: string;
  brain: EngineId;
  ollamaModel: string;
  agentActions: boolean;
  voice: string;
  voiceEngine: VoiceEngine;
  elevenVoiceId: string;
  alwaysListening: boolean;
  wakeWord: boolean;
  skin: string;
  autoUpdate: boolean;
}

export interface EngineStatus {
  id: EngineId;
  label: string;
  blurb: string;
  place: 'device' | 'cloud';
  canAct: boolean;
  available: boolean;
  problem: string | null;
  models: string[];
}

export interface Saved {
  settings: Settings;
  announcement: string | null;
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
  reply: string;
  mind: MindUsed;
  learned: Fact[];
  forgotten: Fact[];
  actions: Outcome[];
  steps: AgentStep[];
  traces: QueryTrace[];
  writes: WriteReceipt[];
  memoryOffline: boolean;
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

export type SettingsChange = Partial<Pick<Settings, 'brain' | 'ollamaModel' | 'agentActions' | 'voice' | 'voiceEngine' | 'elevenVoiceId' | 'alwaysListening' | 'wakeWord' | 'skin' | 'autoUpdate'>>;

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

/** Commands. A rejected promise carries the core's plain-language sentence. */
export const core = {
  settings: () => invoke<Settings>('app_settings'),
  saveSettings: (change: SettingsChange) => invoke<Saved>('save_settings', { change }),
  engines: () => invoke<EngineStatus[]>('engines_list'),
  elevenSetKey: (key: string) => invoke<ElevenVoice[]>('eleven_set_key', { key }),
  elevenVoices: () => invoke<ElevenVoice[]>('eleven_voices'),
  phoneStatus: () => invoke<PhoneStatus>('phone_status'),
  phoneStart: () => invoke<PhoneStatus>('phone_start'),
  phoneStop: () => invoke<PhoneStatus>('phone_stop'),
  updateCheck: () => invoke<UpdateStatus>('update_check'),
  restart: () => invoke<void>('app_restart'),
  scan: () => invoke<Scan>('setup_scan'),
  installNode: () => invoke<FoundNode>('setup_install_node'),
  createGraph: (nodeHome: string, assistantName: string) => invoke<GraphReady>('setup_create_graph', { nodeHome, assistantName }),
  finishSetup: (brain: EngineId, ollamaModel: string, voice: string) => invoke<void>('setup_finish', { brain, ollamaModel, voice }),
  turn: (text: string) => invoke<TurnResult>('assistant_turn', { text }),
  overview: () => invoke<Overview>('memory_overview'),
  forgetFact: (id: string) => invoke<void>('memory_forget_fact', { id }),
  voiceAuthorize: () => invoke<void>('voice_authorize'),
  listenOnce: () => invoke<void>('voice_listen_once'),
  stopListening: () => invoke<void>('voice_stop'),
  speak: (text: string) => invoke<void>('voice_speak', { text }),
  hush: () => invoke<void>('voice_hush'),
  listVoices: () => invoke<void>('voice_list'),
};

/** Subscribe to a core event; returns the unsubscribe function (safe to call in effect cleanup). */
export function on<T>(event: (typeof EVENTS)[keyof typeof EVENTS], handler: (payload: T) => void): () => void {
  let unlisten: UnlistenFn | null = null;
  let cancelled = false;
  listen<T>(event, (e) => handler(e.payload)).then((fn) => {
    if (cancelled) fn();
    else unlisten = fn;
  });
  return () => {
    cancelled = true;
    unlisten?.();
  };
}

/** The core's error sentence, whatever shape the rejection took. */
export function sentence(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
