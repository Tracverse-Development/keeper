/**
 * The window's ONE bridge to the Rust core: typed commands and events.
 * Shapes mirror `src-tauri/src` exactly (serde camelCase); event names mirror
 * `src-tauri/src/kernel/events.rs` (`events.test.ts` keeps the two lists equal).
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

import type { Chat, ChatFound } from './ipc-chats';
import type { ActionDone, Answer, PimAccess, PinnedScene, ElevenVoice, EngineId, EngineStatus, FolderAccess, FoundNode, GraphReady, Imported, KeeperChange, KeeperList, KeeperSaved, KitCatalog, Overview, PhoneStatus, QuestionInfo, Scan, Settings, SettingsChange, ShortcutStatus, Soul, Fact, SystemLoad, Turn, TurnResult, UpdateStatus, VoiceEngine } from './ipc-types';
import type { FeelingsInfo, FocusSession, HealthCheck, PackTrust, PhotoSaved, SeasonNow, PersonalKind, PersonalPicture, RoleInfo, StudioInfo, SystemLive, Touch, TouchReply } from './ipc-studio';
import type { ChangeEntry, Spending } from './ipc-usage';
import type { GiveMode, NewWardrobeItem, Wardrobe } from './ipc-wardrobe';
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
  replyDelta: 'assistant://reply-delta',
  /** A keeper reached a new level: { keeper, level, unlocked } (`kit::levels::check_level_up`). */
  levelUp: 'keeper://level-up',
} as const;

export type * from './ipc-types';
export type * from './ipc-wardrobe';
export type * from './ipc-studio';
export type * from './ipc-usage';
export type * from './ipc-chats';

/** Commands. A rejected promise carries the core's plain-language sentence. */
export const core = {
  settings: () => invoke<Settings>('app_settings'),
  saveSettings: (change: SettingsChange) => invoke<Settings>('save_settings', { change }),
  keepers: () => invoke<KeeperList>('keepers_list'),
  createKeeper: (keeper: { name: string; skin: string; role: string; soul?: string; starter?: string }) => invoke<KeeperList>('keepers_create', { keeper }),
  kit: () => invoke<KitCatalog>('kit_catalog'),
  saveSoul: (soul: Soul) => invoke<Soul>('souls_save', { soul }),
  exportPack: (kind: 'keeper' | 'soul', id: string) => invoke<string>('pack_export', { kind, id }),
  importPack: (text: string) => invoke<Imported>('pack_import', { text }),
  /** Where a pack comes from (its signature and maker), before it is added. */
  checkPack: (text: string) => invoke<PackTrust>('pack_check', { text }),
  wardrobe: () => invoke<Wardrobe>('wardrobe_list'),
  /** Put `item` on `keeper`, in `colour` when given (a swatch id; '' = its own colours; left out = as it is worn). */
  wardrobeWear: (keeper: string, item: string, colour?: string) => invoke<Wardrobe>('wardrobe_wear', { keeper, item, colour: colour ?? null }),
  /** Wear an item `keeper` has on in `colour` (a swatch id; '' = its own colours). */
  wardrobeColour: (keeper: string, item: string, colour: string) => invoke<Wardrobe>('wardrobe_colour', { keeper, item, colour }),
  wardrobeWearSet: (keeper: string, set: string) => invoke<Wardrobe>('wardrobe_wear_set', { keeper, set }),
  wardrobeTakeOff: (keeper: string, item: string) => invoke<Wardrobe>('wardrobe_take_off', { keeper, item }),
  wardrobeGive: (item: string, from: string, to: string, mode: GiveMode) => invoke<Wardrobe>('wardrobe_give', { item, from, to, mode }),
  wardrobeAdd: (item: NewWardrobeItem) => invoke<Wardrobe>('wardrobe_add', { ...item }),
  /** Share one item as a pack file in Downloads; resolves to its path. */
  wardrobeShare: (item: string) => invoke<string>('wardrobe_share', { item }),
  /** Design an item from words (validated, not saved). */
  wardrobeDesign: (description: string) => invoke<{ name: string; part: string; effects: Record<string, number | string> }>('wardrobe_design', { description }),
  systemLoad: () => invoke<SystemLoad>('system_load'),
  activateKeeper: (id: string) => invoke<KeeperList>('keepers_activate', { id }),
  updateKeeper: (id: string, change: KeeperChange) => invoke<KeeperSaved>('keepers_update', { id, change }),
  /** Tie an official set to a mode for a keeper (null clears it). */
  setLoadout: (keeper: string, mode: string, set: string | null) => invoke<KeeperList>('keeper_set_loadout', { keeper, mode, set }),
  /** Dress a keeper for the mode on screen; true when its outfit changed. */
  wearMode: (keeper: string, mode: string) => invoke<boolean>('keeper_wear_mode', { keeper, mode }),
  removeKeeper: (id: string) => invoke<KeeperList>('keepers_remove', { id }),
  chats: (keeper?: string) => invoke<Chat[]>('chats_list', { keeper }),
  chatTurns: (chat: string, keeper?: string) => invoke<Turn[]>('chat_turns', { keeper, chat }),
  /** Rename and/or pin a chat (left out = unchanged), and search a keeper's conversations. */
  chatChange: (chat: string, change: { title?: string; pinned?: boolean }, keeper?: string) => invoke<Chat>('chat_change', { keeper, chat, ...change }),
  chatsSearch: (query: string, keeper?: string) => invoke<ChatFound[]>('chats_search', { keeper, query }),
  /** Erase a chat and its turns from the keeper's graph; resolves to the number of turns erased. */
  deleteChat: (chat: string, keeper?: string) => invoke<number>('chat_delete', { keeper, chat }),
  catalog: () => invoke<QuestionInfo[]>('catalog_list'),
  ask: (question: string, args: Record<string, string>, keeper?: string) => invoke<Answer>('catalog_run', { keeper, question, args }),
  folders: () => invoke<FolderAccess[]>('setup_folders'),
  talkHide: () => invoke<void>('talk_hide'),
  shortcutStatus: () => invoke<ShortcutStatus>('talk_shortcut_status'),
  engines: () => invoke<EngineStatus[]>('engines_list'),
  elevenSetKey: (key: string) => invoke<ElevenVoice[]>('eleven_set_key', { key }),
  elevenVoices: () => invoke<ElevenVoice[]>('eleven_voices'),
  /** Speak `text` with a voice without saving it (the Studio's Test button). */
  voiceTry: (engine: VoiceEngine, id: string, text: string) => invoke<void>('voice_try', { engine, id, text }),
  /** The Studio's data: level and unlocks, paint zones, materials, habits, rarities. */
  keeperStudio: (keeper?: string) => invoke<StudioInfo>('keeper_studio', { keeper }),
  /** Modes: list, save (an edited built-in or the person's own), reset or delete; the skills a mode can have. */
  modesList: () => invoke<RoleInfo[]>('modes_list'),
  /** A live reading of this computer (the live panel polls it while on screen). */
  systemLive: () => invoke<SystemLive>('system_live'),
  /** Open what a panel shows: a web page in the browser, or a file in your home (open, or show in the Finder). */
  stageOpen: (target: string, how: 'open' | 'reveal' = 'open') => invoke<void>('stage_open', { target, how }),
  /** The keeper's simulated feelings, and resetting them. */
  keeperFeelings: (keeper?: string, mode?: string) => invoke<FeelingsInfo>('keeper_feelings', { keeper, mode }),
  feelingsReset: (keeper?: string) => invoke<FeelingsInfo>('feelings_reset', { keeper }),
  /** The person tapped or stroked the character: what it says back, from its soul and mood. */
  keeperTouch: (kind: Touch, about: { keeper?: string; mode?: string; you?: string }) => invoke<TouchReply>('keeper_touch', { kind, ...about }),
  modesSave: (mode: RoleInfo) => invoke<RoleInfo[]>('modes_save', { mode }),
  modesReset: (id: string) => invoke<RoleInfo[]>('modes_reset', { id }),
  skillsList: () => invoke<{ name: string; what: string }[]>('skills_list'),
  /** Personal pictures (pendant, shirt): kept only on this computer, level-locked. */
  personalList: (keeper: string) => invoke<PersonalPicture[]>('personal_list', { keeper }),
  personalSet: (keeper: string, kind: PersonalKind, base64: string) => invoke<PersonalPicture[]>('personal_set', { keeper, kind, base64 }),
  personalRemove: (keeper: string, kind: PersonalKind) => invoke<PersonalPicture[]>('personal_remove', { keeper, kind }),
  phoneStatus: () => invoke<PhoneStatus>('phone_status'),
  phoneStart: () => invoke<PhoneStatus>('phone_start'),
  phoneStop: () => invoke<PhoneStatus>('phone_stop'),
  updateCheck: () => invoke<UpdateStatus>('update_check'),
  restart: () => invoke<void>('app_restart'),
  scan: () => invoke<Scan>('setup_scan'),
  installNode: () => invoke<FoundNode>('setup_install_node'),
  createGraph: (nodeHome: string, assistantName: string) => invoke<GraphReady>('setup_create_graph', { nodeHome, assistantName }),
  finishSetup: (brain: EngineId, model: string, voice: string) => invoke<void>('setup_finish', { brain, model, voice }),
  /** `mode`: the chat's mode (a role id; absent = the keeper's default). */
  turn: (text: string, keeper?: string, chat?: string, mode?: string, attach?: Handed) => invoke<TurnResult>('assistant_turn', { text, keeper, chat, mode, attach }),
  /** One text for support: version, system, every check and Keeper's recent problems (no conversations or facts). */
  supportReport: () => invoke<string>('support_report'),
  /** Undo a forget or a replacement: the fact is remembered again as it was. */
  restoreFact: (fact: Fact, keeper?: string) => invoke<Fact>('memory_restore_fact', { keeper, fact: { text: fact.text, category: fact.category, at: fact.at, mode: fact.mode ?? '', topics: fact.topics ?? [] } }),
  /** The changelog entries newer than what the person last saw, and marking them seen. */
  whatsNew: () => invoke<ChangeEntry[]>('whats_new'),
  whatsNewSeen: () => invoke<void>('whats_new_seen'),
  /** Run every health check now, and do the one fix a check offers (then check again). */
  healthCheck: () => invoke<HealthCheck[]>('health_check'),
  healthFix: (id: string) => invoke<HealthCheck[]>('health_fix', { id }),
  /** The focus session running now (null: none), and ending it early. */
  focusState: () => invoke<FocusSession | null>('focus_state'),
  focusStop: () => invoke<FocusSession | null>('focus_stop'),
  /** Is the child profile on, and turning it on (with a new passcode) or off (with that passcode); resolves to whether it is on now. */
  childProfile: () => invoke<boolean>('child_profile'),
  childProfileSet: (on: boolean, passcode: string) => invoke<boolean>('child_profile_set', { on, passcode }),
  /** The season open today with this keeper's quest progress (null: none open), and claiming an item whose quest is finished. */
  seasonNow: (keeper?: string) => invoke<SeasonNow | null>('season_now', { keeper }),
  seasonClaim: (keeper: string, item: string) => invoke<SeasonNow>('season_claim', { keeper, item }),
  /** This month's spending on cloud minds and the limit set for it. */
  usageMonth: () => invoke<Spending>('usage_month'),
  /**
   * Photo mode: save a still of keeper `keeper` (its id) the Studio drew (PNG bytes in base64) to
   * ~/Pictures/Keeper on this Mac; the core checks the PNG and names the file. Resolves to where it went.
   */
  photoSave: (keeper: string, data: string) => invoke<PhotoSaved>('photo_save', { keeper, data }),
  /** Save every keeper, its memory and the kit as one sealed file in Downloads. */
  backupSave: (passphrase: string) => invoke<{ path: string; keepers: number; records: number }>('backup_save', { passphrase }),
  /** Bring a backup in (`data`: the file's bytes in base64): adds and merges, never removes. */
  backupRestore: (passphrase: string, data: string) => invoke<{ keepers: string[]; written: number; already: number }>('backup_restore', { passphrase, data }),
  /** Look at something handed over (a dropped file, dragged text): its name and size; rejects in plain words when it cannot be read. */
  attachPeek: (attach: Handed) => invoke<HandedPeek>('attach_peek', { attach }),
  stageAction: (action: PanelAction, keeper?: string) => invoke<ActionDone>('stage_action', { keeper, action }),
  planDecide: (token: string, approve: boolean) => invoke<TurnResult>('plan_decide', { token, approve }),
  briefToday: () => invoke<TurnResult | null>('brief_today'),
  /** Start the next turn's engine now (opening, switching keeper, coming back); returns spares ready. */
  /** The Stop button: end the turn in progress. */
  cancel: () => invoke<void>('assistant_cancel'),
  /** Keeper installs an engine itself (Claude Code); returns where it is. */
  engineSetup: (engine: string) => invoke<string>('engine_setup', { engine }),
  /** Open Terminal running the engine so the person signs in. */
  engineSignIn: (engine: string) => invoke<void>('engine_sign_in', { engine }),
  /** Remove Keeper from this Mac (stops its own node; deletes its folder unless `keepMemory`). */
  removeApp: (keepMemory: boolean) => invoke<void>('setup_remove', { keepMemory }),
  warm: (keeper?: string) => invoke<number>('assistant_warm', { keeper }),
  pimAccess: () => invoke<PimAccess>('pim_access'),
  pinnedScenes: (keeper?: string) => invoke<PinnedScene[]>('scenes_pinned', { keeper }),
  pinScene: (title: string, panels: unknown[], keeper?: string) => invoke<PinnedScene>('scene_pin', { keeper, title, panels }),
  unpinScene: (id: string, keeper?: string) => invoke<void>('scene_unpin', { keeper, id }),
  pimRequestAccess: () => invoke<PimAccess>('pim_request_access'),
  overview: (keeper?: string) => invoke<Overview>('memory_overview', { keeper }),
  /** Delete a reminder: erased from the keeper's graph, and it will not fire. */
  reminderCancel: (id: string, keeper?: string) => invoke<void>('reminder_cancel', { id, keeper }),
  /** Erase one fact from a keeper's graph (the active keeper when none is named). */
  forgetFact: (id: string, keeper?: string) => invoke<void>('memory_forget_fact', { id, keeper }),
  voiceAuthorize: () => invoke<void>('voice_authorize'),
  listenOnce: () => invoke<void>('voice_listen_once'),
  stopListening: () => invoke<void>('voice_stop'),
  /** `queue`: say it after what is being said (a reply's rest after its first sentence). */
  speak: (text: string, queue = false) => invoke<void>('voice_speak', { text, queue }),
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
/** Something handed to a keeper with a message: a dropped file's path, or dragged text. */
export type Handed = { path: string } | { text: string };

/** What the core says about it before anything is sent (`assistant::attach::Peek`). */
export interface HandedPeek {
  name: string;
  chars: number;
  truncated: boolean;
}

/**
 * Files dragged over the window (`over`), let go on it (`drop`, with their paths) or taken away
 * (`leave`): the system's own drag events, which carry real paths (a web page's never do).
 */
export function onFileDrop(handler: (e: { kind: 'over' | 'drop' | 'leave'; paths: string[] }) => void): () => void {
  const hear = (event: string, kind: 'over' | 'drop' | 'leave') => {
    let off: UnlistenFn | null = null;
    let cancelled = false;
    listen<{ paths?: string[] }>(event, (e) => handler({ kind, paths: e.payload?.paths ?? [] })).then((fn) => {
      if (cancelled) fn();
      else off = fn;
    });
    return () => {
      cancelled = true;
      off?.();
    };
  };
  const offs = [hear('tauri://drag-enter', 'over'), hear('tauri://drag-drop', 'drop'), hear('tauri://drag-leave', 'leave')];
  return () => offs.forEach((off) => off());
}

export function sentence(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
