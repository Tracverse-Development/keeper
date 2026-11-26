/**
 * The palette's commands for the screen as it is now: switch to each other keeper, new chat,
 * brief, stop, open settings / memory / scenes, each pinned scene. Built by the dashboard from
 * what it already has (no new state); a pure builder so the list is easy to extend.
 */
import type { Command } from './rank';

export interface PaletteDeps {
  keepers: { id: string; name: string }[];
  activeKeeper: string | null;
  pinned: { id: string; title: string }[];
  busy: boolean;
  activate: (id: string) => void;
  newChat: () => void;
  brief: () => void;
  /** The week in review, from memory. */
  week: () => void;
  stop: () => void;
  openSettings: () => void;
  /** Optional so older callers and tests keep working. */
  openStudio?: () => void;
  /** The modes a chat can be in, and switching to one. */
  modes?: { id: string; title: string }[];
  setMode?: (mode: string) => void;
  openMemory: () => void;
  openScenes: () => void;
  openPinned: (id: string) => void;
}

export function paletteCommands(d: PaletteDeps): Command[] {
  const out: Command[] = [
    { id: 'new-chat', title: 'New chat', keywords: ['start', 'fresh', 'clear'], run: d.newChat },
    { id: 'brief', title: 'Brief me', keywords: ['morning', 'day', 'agenda', 'today'], hint: 'Your day: calendar, reminders, files', run: d.brief },
    { id: 'week', title: 'Week in review', keywords: ['weekly', 'review', 'summary', 'recap'], hint: 'What we talked about, what I learned and did', run: d.week },
  ];
  if (d.busy) out.unshift({ id: 'stop', title: 'Stop', keywords: ['cancel', 'halt', 'quiet'], hint: 'End the answer in progress', run: d.stop });
  for (const k of d.keepers) {
    if (k.id !== d.activeKeeper) out.push({ id: `keeper-${k.id}`, title: `Switch to ${k.name}`, keywords: ['keeper', 'change', 'talk'], run: () => d.activate(k.id) });
  }
  out.push(
    { id: 'scenes', title: 'Show scenes', keywords: ['stage', 'panels', 'lesson'], run: d.openScenes },
    { id: 'memory', title: 'Open memory', keywords: ['dkg', 'graph', 'facts', 'knowledge'], run: d.openMemory },
    { id: 'settings', title: 'Open settings', keywords: ['preferences', 'voice', 'brain'], run: d.openSettings },
    ...(d.modes && d.setMode ? d.modes.map((m) => ({ id: `mode-${m.id}`, title: `${m.title} mode`, keywords: ['mode', 'switch', 'job', m.id], hint: 'For this chat', run: () => d.setMode?.(m.id) })) : []),
    ...(d.openStudio ? [{ id: 'studio', title: 'Open the Studio', keywords: ['customise', 'customize', 'look', 'colour', 'color', 'wardrobe', 'outfit', 'level', 'habits', 'voice', 'rarity'], hint: 'Make your keeper your own', run: d.openStudio }] : []),
  );
  for (const p of d.pinned) out.push({ id: `pin-${p.id}`, title: `Open ${p.title}`, keywords: ['pinned', 'scene'], hint: 'Pinned scene', run: () => d.openPinned(p.id) });
  return out;
}
