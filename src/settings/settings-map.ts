/**
 * The map of Settings: its groups (the tabs across the top) and every section with the words
 * people look for it by. One list decides what a tab shows and what a search finds; pure and
 * tested (every section is in exactly one group and can be found).
 */
export type GroupId = 'health' | 'keeper' | 'how' | 'data' | 'mac';

export const GROUPS: readonly { id: GroupId; title: string }[] = [
  { id: 'health', title: 'Health' },
  { id: 'keeper', title: 'This keeper' },
  { id: 'how', title: 'How it works' },
  { id: 'data', title: 'Your data' },
  { id: 'mac', title: 'This Mac' },
];

export type SectionId = 'health' | 'name' | 'soul' | 'role' | 'body' | 'studio' | 'brain' | 'reading' | 'showing' | 'spending' | 'voice' | 'button' | 'phone' | 'share' | 'backup' | 'child' | 'updates' | 'remove';

export const SECTIONS: readonly { id: SectionId; group: GroupId; title: string; words: string }[] = [
  { id: 'health', group: 'health', title: 'Is everything working?', words: 'health check problem error memory node not working fix status' },
  { id: 'name', group: 'keeper', title: 'This keeper', words: 'name rename wake word hey graph' },
  { id: 'soul', group: 'keeper', title: 'Soul', words: 'personality character tone modes studio' },
  { id: 'role', group: 'keeper', title: 'Role', words: 'mode job assistant tutor researcher companion system administrator' },
  { id: 'body', group: 'keeper', title: 'Body', words: 'robot puppy species skin character' },
  { id: 'studio', group: 'keeper', title: 'Look, inventory and mods', words: 'studio outfit wardrobe colour color clothes marketplace level' },
  { id: 'brain', group: 'keeper', title: 'Brain', words: 'mind engine model claude codex gemini ollama local act computer plan approve permission' },
  { id: 'reading', group: 'how', title: 'Reading', words: 'text size font bigger larger small accessibility motion eyes' },
  { id: 'showing', group: 'how', title: 'Showing things', words: 'visual panels stage text prepare scenes quick replies helper model speed' },
  { id: 'spending', group: 'how', title: 'Spending', words: 'cost money limit cap budget dollars month price' },
  { id: 'voice', group: 'how', title: 'Voice', words: 'speak listen microphone always listening wake word elevenlabs sound talk' },
  { id: 'button', group: 'how', title: 'Keeper button', words: 'shortcut hotkey keyboard push to talk key' },
  { id: 'phone', group: 'how', title: 'Your phone', words: 'mobile qr pair link iphone android' },
  { id: 'share', group: 'data', title: 'Share', words: 'pack export import send file keeper soul' },
  { id: 'backup', group: 'data', title: 'Backup', words: 'save restore move new mac export passphrase copy data' },
  { id: 'child', group: 'data', title: 'Child profile', words: 'kid children parent passcode safe family lock' },
  { id: 'updates', group: 'mac', title: 'Updates', words: 'version update automatic new release' },
  { id: 'remove', group: 'mac', title: 'Remove', words: 'delete uninstall remove keeper quit node folder' },
];

/** The sections to show: with words typed, every section matching all of them (in any group); otherwise the chosen group's. */
export function shown(group: GroupId, query: string): Set<SectionId> {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const list = words.length === 0 ? SECTIONS.filter((s) => s.group === group) : SECTIONS.filter((s) => words.every((w) => `${s.title} ${s.words}`.toLowerCase().includes(w)));
  return new Set(list.map((s) => s.id));
}
