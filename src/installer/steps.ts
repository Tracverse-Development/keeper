/**
 * The installer's steps and the pure decisions behind them (tested in steps.test.ts).
 * The screen (InstallerScreen.tsx) only draws what these say.
 */
import type { EngineId, FolderAccess, Scan } from '../kernel/ipc';

export const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'node', title: 'Memory node' },
  { id: 'graph', title: 'Your keeper' },
  { id: 'mind', title: 'Mind' },
  { id: 'permissions', title: 'Permissions' },
  { id: 'meet', title: 'Meet' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

export type NodeFinding = 'found' | 'stopped' | 'none';

/** What the scan says about the DKG node. */
export function nodeFinding(scan: Scan): NodeFinding {
  if (scan.node) return 'found';
  if (scan.silentNodes.length > 0) return 'stopped';
  return 'none';
}

/** The mind to pre-select: a local model when there is one, else the built-in mind. */
export function suggestedMind(scan: Scan): { brain: EngineId; model: string } {
  if (scan.ollamaModels.length > 0) return { brain: 'ollama', model: scan.ollamaModels[0] };
  return { brain: 'reflex', model: '' };
}

/** A short, safe assistant name (mirrors the core's check in setup::setup_create_graph). */
export function validName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 24 && /^[\p{L}\p{N} -]+$/u.test(trimmed);
}

/** `did:dkg:base:84532/0x26b4…c3fc/456` → `did:dkg:base:84532/0x26b4…c3fc/456` shortened in the middle. */
export function shortId(id: string, keep = 14): string {
  return id.length <= keep * 2 + 1 ? id : `${id.slice(0, keep)}…${id.slice(-keep)}`;
}

/** Where one permission stands: not asked yet (or asking), granted, or refused. */
export type PermissionStatus = 'waiting' | 'allowed' | 'denied';

export const PERMISSION_WORDS: Record<PermissionStatus, string> = { waiting: 'Waiting', allowed: 'Allowed', denied: 'Not allowed' };

/** Microphone + speech recognition, from the helper's `authorized` voice event (null: not asked yet). */
export function voicePermission(auth: { speech: string; mic: boolean } | null): PermissionStatus {
  if (!auth) return 'waiting';
  return auth.speech === 'authorized' && auth.mic ? 'allowed' : 'denied';
}

/** The folders, from `core.folders()` (null: not asked yet). Any folder refused = not allowed. */
export function foldersPermission(folders: FolderAccess[] | null): PermissionStatus {
  if (!folders) return 'waiting';
  return folders.length > 0 && folders.every((f) => f.granted) ? 'allowed' : 'denied';
}
