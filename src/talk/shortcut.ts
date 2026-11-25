/**
 * The keeper button's shortcut as people read it: "Alt+Space" → "⌥Space",
 * "CommandOrControl+Shift+K" → "⇧⌘K". Modifiers take the Mac's own order (⌃ ⌥ ⇧ ⌘) and
 * symbols; the key keeps its name ("Space", "F5"), with "KeyK" / "Digit5" shortened to "K" / "5".
 * The shortcut text is the core's (`hotkey::parse`, Tauri's accelerator syntax).
 */
const MODIFIERS: Record<string, string> = {
  ctrl: '⌃',
  control: '⌃',
  alt: '⌥',
  option: '⌥',
  shift: '⇧',
  cmd: '⌘',
  command: '⌘',
  commandorcontrol: '⌘',
  cmdorctrl: '⌘',
  cmdorcontrol: '⌘',
  commandorctrl: '⌘',
  super: '⌘',
  meta: '⌘',
};
const ORDER = ['⌃', '⌥', '⇧', '⌘'];

function keyName(key: string): string {
  const k = key.replace(/^(key|digit)(?=\w$)/i, '');
  return k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1);
}

/** The symbol form of a shortcut; an empty shortcut (turned off) gives "". */
export function shortcutSymbols(shortcut: string): string {
  const parts = shortcut.split('+').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  const mods = new Set<string>();
  const keys: string[] = [];
  for (const part of parts) {
    const symbol = MODIFIERS[part.toLowerCase()];
    if (symbol) mods.add(symbol);
    else keys.push(keyName(part));
  }
  return ORDER.filter((m) => mods.has(m)).join('') + keys.join('');
}
