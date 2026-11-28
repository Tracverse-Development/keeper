/** Words for Keeper's file viewer (pure, tested). */

/** "12 KB", "3.4 MB". */
export function sizeWords(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let n = bytes / 1024;
  let unit = 0;
  while (n >= 1024 && unit < units.length - 1) {
    n /= 1024;
    unit += 1;
  }
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[unit]}`;
}

/** "Today 3:04 PM", "Yesterday", "12 Nov 2026" (the visitor's own zone; only after hydration). */
export function whenWords(iso: string, now: Date = new Date()): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(t)) / 86_400_000);
  if (days === 0) return `Today ${t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (days === 1) return 'Yesterday';
  return t.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The crumbs of "~/Documents/Taxes" with the full path each one opens. */
export function crumbs(shown: string, real: string): { label: string; path: string }[] {
  const parts = shown.split('/').filter(Boolean);
  const realParts = real.split('/');
  return parts.map((label, i) => ({
    label: label === '~' ? 'Home' : label,
    path: realParts.slice(0, realParts.length - (parts.length - 1 - i)).join('/') || '/',
  }));
}

/** At most `keep` crumbs: the last ones, after a "…" that opens the folder before them. */
export function fewCrumbs(all: { label: string; path: string }[], keep = 3): { label: string; path: string }[] {
  if (all.length <= keep) return all;
  const hidden = all[all.length - keep - 1];
  return [{ label: '…', path: hidden.path }, ...all.slice(-keep)];
}

/** A question to the keeper about a file or folder. */
export function askAbout(name: string, folder: boolean): string {
  return folder ? `What's in my ${name} folder?` : `Tell me about ${name}.`;
}
