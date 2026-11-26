/**
 * The agent's tool calls in plain words (pure; tested in activity.test.ts): each step narrated as a
 * person would say it, with the kind of work for its animation (`narrate`), a URL's host, and a
 * path as breadcrumbs (files and folder panels).
 */

export type DetailKind = 'path' | 'url' | 'text';

/** A detail is a URL if it has a scheme, a path if it is one word with a slash or starts at ~ or /. */
export function detailKind(detail: string): DetailKind {
  const d = detail.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(d)) return 'url';
  if (!/\s/.test(d) && (d.startsWith('/') || d.startsWith('~') || d.includes('/'))) return 'path';
  return 'text';
}

/** The host of a URL, for a short chip ("en.wikipedia.org"); the input itself if it will not parse. */
export function urlHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/**
 * A path as breadcrumbs: "~/Downloads/a.pdf" → ["~", "Downloads", "a.pdf"]. Long paths keep their
 * last `max` pieces behind a leading "…" so the file stays visible.
 */
export function breadcrumbs(path: string, max = 4): string[] {
  const pieces = path.trim().split(/[\\/]+/).filter(Boolean);
  if (pieces.length <= max) return pieces;
  return ['…', ...pieces.slice(-(max - 1))];
}

/** What kind of work a step is, for its animation. */
export type ActKind = 'folder' | 'search' | 'read' | 'write' | 'move' | 'create' | 'remove' | 'open' | 'process' | 'measure' | 'web' | 'work';

export interface Narration {
  /** What a person would say: "Looking in Applications", never a command line. */
  words: string;
  kind: ActKind;
}

/** A place or file by the name a person uses ("~" is "your home folder"). */
export function placeName(path: string): string {
  const p = path.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
  if (p === '~' || p === '' || /^\/Users\/[^/]+$/.test(p)) return 'your home folder';
  if (p === '.') return 'this folder';
  const last = p.split('/').filter(Boolean).pop() ?? p;
  return last.replace(/\*+/g, '').trim() || 'files';
}

/** Arguments of a shell piece that are not flags. */
function args(piece: string): string[] {
  return (piece.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).slice(1).filter((a) => !a.startsWith('-') && !/^\d?>/.test(a) && a !== '2>&1');
}

/** The value after a flag ("-name foo" → "foo"). */
function flag(piece: string, name: string): string | null {
  const m = piece.match(new RegExp(`${name}\\s+("[^"]*"|'[^']*'|\\S+)`));
  return m ? m[1].replace(/^["']|["']$/g, '').replace(/\*/g, '') : null;
}

const quoted = (s: string) => `“${s}”`;

/** One shell piece in words, or null when it says nothing worth showing (a pipe's grep, head…). */
function shellWords(piece: string): Narration | null {
  const [cmd = ''] = piece.trim().split(/\s+/);
  const a = args(piece);
  switch (cmd) {
    case 'ls':
      // Two folders with one name (/Applications and ~/Applications) are said once.
      return { words: `Looking in ${[...new Set((a.length ? a : ['.']).map(placeName))].slice(0, 2).join(' and ')}`, kind: 'folder' };
    case 'find':
    case 'mdfind': {
      const name = flag(piece, '-i?name') ?? (cmd === 'mdfind' ? a[a.length - 1] : null);
      return { words: name ? `Searching for ${quoted(name)}` : `Searching ${placeName(a[0] ?? '.')}`, kind: 'search' };
    }
    case 'cat':
    case 'less':
    case 'head':
    case 'tail':
      return a.length ? { words: `Reading ${placeName(a[a.length - 1])}`, kind: 'read' } : null;
    case 'ps':
    case 'pgrep':
    case 'lsof':
      return { words: 'Checking which apps are running', kind: 'process' };
    case 'mv':
      return a.length >= 2 ? { words: `Moving ${placeName(a[0])} to ${placeName(a[a.length - 1])}`, kind: 'move' } : null;
    case 'cp':
      return a.length >= 2 ? { words: `Copying ${placeName(a[0])} to ${placeName(a[a.length - 1])}`, kind: 'move' } : null;
    case 'mkdir':
      return a.length ? { words: `Creating the folder ${placeName(a[a.length - 1])}`, kind: 'create' } : null;
    case 'touch':
      return a.length ? { words: `Creating ${placeName(a[a.length - 1])}`, kind: 'create' } : null;
    case 'rm':
    case 'trash':
    case 'rmdir':
      return a.length ? { words: `Removing ${placeName(a[a.length - 1])}`, kind: 'remove' } : null;
    case 'open':
      return a.length ? { words: `Opening ${placeName(a[a.length - 1])}`, kind: 'open' } : null;
    case 'du':
    case 'df':
      return { words: 'Measuring how much space is used', kind: 'measure' };
    case 'cd':
    case 'grep':
    case 'rg':
    case 'head -n':
    case 'sort':
    case 'uniq':
    case 'wc':
    case 'echo':
      return null;
    default:
      return null;
  }
}

/** A step in words a person would say, with the kind of work it is. Never shows the command. */
export function narrate(tool: string, detail: string): Narration {
  const t = tool.trim().toLowerCase();
  const d = detail.trim();
  if (/^(bash|command|shell|terminal|exec|run)/.test(t)) {
    for (const piece of d.split(/&&|;|\|/)) {
      const n = shellWords(piece);
      if (n) return n;
    }
    return { words: 'Working on your computer', kind: 'work' };
  }
  if (/^read/.test(t)) return { words: `Reading ${placeName(d)}`, kind: 'read' };
  if (/^(write|create|notebookedit)/.test(t)) return { words: `Writing ${placeName(d)}`, kind: 'write' };
  if (/^(edit|multiedit|patch)/.test(t)) return { words: `Editing ${placeName(d)}`, kind: 'write' };
  if (/^glob/.test(t)) return { words: `Looking for ${quoted(placeName(d))}`, kind: 'search' };
  if (/^(grep|search|find)/.test(t)) return { words: `Searching inside files for ${quoted(d.split(/\s+/)[0] ?? d)}`, kind: 'search' };
  if (/^(ls|list)/.test(t)) return { words: `Looking in ${placeName(d)}`, kind: 'folder' };
  if (/^websearch/.test(t)) return { words: `Searching the web for ${quoted(d)}`, kind: 'web' };
  if (/^web/.test(t)) return { words: `Reading ${urlHost(d)}`, kind: 'web' };
  return { words: 'Working on it', kind: 'work' };
}
