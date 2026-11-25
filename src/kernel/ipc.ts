/**
 * The window's ONE bridge to the Rust core: typed commands and events.
 * Shapes mirror `src-tauri/src` exactly (serde camelCase); event names mirror
 * `src-tauri/src/kernel/events.rs` (`events.test.ts` keeps the two lists equal).
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

import type { ActionDone, Answer, PimAccess, PinnedScene, Chat, ElevenVoice, EngineId, EngineStatus, FolderAccess, FoundNode, GraphReady, Imported, KeeperChange, KeeperList, KeeperSaved, KitCatalog, Overview, PhoneStatus, QuestionInfo, Scan, Settings, SettingsChange, ShortcutStatus, Soul, SystemLoad, Turn, TurnResult, UpdateStatus } from './ipc-types';
import type { PanelAction } from './panel-spec';

export const EVENTS = {
  assistantPhase: 'assistant://phase',
  assistantSays: 'assistant://says',
  voiceEvent: 'voice://event',
  voiceCommand: 'voice://command',
  setupProgress: 'setup://progress',
  memoryWritten: 'memory://written',
  phoneTurn: 'phone://turn',
  appUpdate: 'app://update',
  assistantReply: 'assistant://reply',
  stagePanel: 'stage://panel',
  earlyReply: 'assistant://early-reply',
} as const;

export type * from './ipc-types';

/** Commands. A rejected promise carries the core's plain-language sentence. */
export const core = {
  settings: () => invoke<Settings>('app_settings'),
  saveSettings: (change: SettingsChange) => invoke<Settings>('save_settings', { change }),
  keepers: () => invoke<KeeperList>('keepers_list'),
  createKeeper: (keeper: { name: string; skin: string; role: string; soul?: string }) => invoke<KeeperList>('keepers_create', { keeper }),
  kit: () => invoke<KitCatalog>('kit_catalog'),
  saveSoul: (soul: Soul) => invoke<Soul>('souls_save', { soul }),
  exportPack: (kind: 'keeper' | 'soul', id: string) => invoke<string>('pack_export', { kind, id }),
  importPack: (text: string) => invoke<Imported>('pack_import', { text }),
  systemLoad: () => invoke<SystemLoad>('system_load'),
  activateKeeper: (id: string) => invoke<KeeperList>('keepers_activate', { id }),
  updateKeeper: (id: string, change: KeeperChange) => invoke<KeeperSaved>('keepers_update', { id, change }),
  removeKeeper: (id: string) => invoke<KeeperList>('keepers_remove', { id }),
  chats: (keeper?: string) => invoke<Chat[]>('chats_list', { keeper }),
  chatTurns: (chat: string, keeper?: string) => invoke<Turn[]>('chat_turns', { keeper, chat }),
  catalog: () => invoke<QuestionInfo[]>('catalog_list'),
  ask: (question: string, args: Record<string, string>, keeper?: string) => invoke<Answer>('catalog_run', { keeper, question, args }),
  folders: () => invoke<FolderAccess[]>('setup_folders'),
  talkHide: () => invoke<void>('talk_hide'),
  shortcutStatus: () => invoke<ShortcutStatus>('talk_shortcut_status'),
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
  finishSetup: (brain: EngineId, model: string, voice: string) => invoke<void>('setup_finish', { brain, model, voice }),
  turn: (text: string, keeper?: string, chat?: string) => invoke<TurnResult>('assistant_turn', { text, keeper, chat }),
  stageAction: (action: PanelAction, keeper?: string) => invoke<ActionDone>('stage_action', { keeper, action }),
  planDecide: (token: string, approve: boolean) => invoke<TurnResult>('plan_decide', { token, approve }),
  briefToday: () => invoke<TurnResult | null>('brief_today'),
  pimAccess: () => invoke<PimAccess>('pim_access'),
  pinnedScenes: (keeper?: string) => invoke<PinnedScene[]>('scenes_pinned', { keeper }),
  pinScene: (title: string, panels: unknown[], keeper?: string) => invoke<PinnedScene>('scene_pin', { keeper, title, panels }),
  unpinScene: (id: string, keeper?: string) => invoke<void>('scene_unpin', { keeper, id }),
  pimRequestAccess: () => invoke<PimAccess>('pim_request_access'),
  overview: (keeper?: string) => invoke<Overview>('memory_overview', { keeper }),
  forgetFact: (id: string) => invoke<void>('memory_forget_fact', { id }),
  voiceAuthorize: () => invoke<void>('voice_authorize'),
  listenOnce: () => invoke<void>('voice_listen_once'),
  stopListening: () => invoke<void>('voice_stop'),
  speak: (text: string) => invoke<void>('voice_speak', { text }),
  hush: () => invoke<void>('voice_hush'),
  listVoices: () => invoke<void>('voice_list'),
};

/** Which window this is: "main" or "talk" (the push-to-talk window). */
export function windowLabel(): string {
  try {
    return getCurrentWindow().label;
  } catch {
    return 'main';
  }
}

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
