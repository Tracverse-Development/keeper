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
/** Network and system tools, by what they find out (founder 2026-11-26: every step said "Working on your computer"). */
const LOOKS: Record<string, Narration> = {
  ping: { words: 'Checking how fast your router and the internet answer', kind: 'measure' },
  arp: { words: 'Listing the devices your Mac has seen nearby', kind: 'search' },
  ndp: { words: 'Listing the devices your Mac has seen nearby', kind: 'search' },
  networksetup: { words: 'Checking your Wi-Fi settings', kind: 'read' },
  ipconfig: { words: 'Reading your network address', kind: 'read' },
  ifconfig: { words: 'Reading your network connections', kind: 'read' },
  route: { words: 'Finding your router', kind: 'search' },
  netstat: { words: 'Finding your router and open connections', kind: 'search' },
  scutil: { words: 'Reading your network settings', kind: 'read' },
  dig: { words: 'Looking up a web address', kind: 'web' },
  nslookup: { words: 'Looking up a web address', kind: 'web' },
  host: { words: 'Looking up a web address', kind: 'web' },
  traceroute: { words: 'Tracing the path to the internet', kind: 'web' },
  tailscale: { words: 'Checking your private network', kind: 'read' },
  dscacheutil: { words: 'Looking up device names', kind: 'search' },
  'dns-sd': { words: 'Looking for devices that announce themselves', kind: 'search' },
  system_profiler: { words: "Reading this Mac's hardware report", kind: 'read' },
  sysctl: { words: 'Reading how this Mac is set up', kind: 'measure' },
  vm_stat: { words: 'Measuring memory use', kind: 'measure' },
  memory_pressure: { words: 'Measuring memory use', kind: 'measure' },
  top: { words: 'Seeing which apps are busiest', kind: 'process' },
  diskutil: { words: 'Reading your disks', kind: 'measure' },
  pmset: { words: 'Checking your battery and power', kind: 'measure' },
  uptime: { words: 'Checking how long this Mac has been on', kind: 'measure' },
  sw_vers: { words: 'Checking your macOS version', kind: 'read' },
  defaults: { words: 'Reading a setting', kind: 'read' },
  launchctl: { words: 'Checking background services', kind: 'process' },
};

function shellWords(piece: string): Narration | null {
  // A full path counts by its name; "sudo" is not what the step does.
  const words = piece.trim().split(/\s+/).filter((w, i) => !(i === 0 && w === 'sudo'));
  const cmd = (words[0] ?? '').split('/').pop() ?? '';
  piece = [cmd, ...words.slice(1)].join(' ');
  const look = LOOKS[cmd.toLowerCase()];
  if (look) return look;
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
    // A chain is said by what its parts find out: the first two different things, joined.
    const found: Narration[] = [];
    for (const piece of d.split(/&&|;|\|/)) {
      const n = shellWords(piece);
      if (n && !found.some((f) => f.words === n.words)) found.push(n);
    }
    if (found.length === 0) return { words: 'Working on your computer', kind: 'work' };
    if (found.length === 1) return found[0];
    const second = found[1].words;
    return { words: `${found[0].words} and ${second.charAt(0).toLowerCase()}${second.slice(1)}`, kind: found[0].kind };
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

/** The status line for a live step ("Bash: arp -an" → "Listing the devices…"); other text unchanged. */
export function stepWords(detail: string): string {
  const m = /^([A-Za-z]+):\s(.*)$/s.exec(detail);
  return m ? `${narrate(m[1], m[2]).words}…` : detail;
}

/** Steps in words, with neighbours that say the same thing grouped ("× 3"). */
export function groupSteps(steps: { tool: string; detail: string }[]): (Narration & { times: number; step: { tool: string; detail: string } })[] {
  const out: (Narration & { times: number; step: { tool: string; detail: string } })[] = [];
  for (const step of steps) {
    const n = narrate(step.tool, step.detail);
    const last = out[out.length - 1];
    if (last && last.words === n.words) last.times += 1;
    else out.push({ ...n, times: 1, step });
  }
  return out;
}
