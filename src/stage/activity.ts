/**
 * The agent's tool calls in plain words (pure; tested in activity.test.ts): which verb and icon a
 * tool gets, whether its detail is a path, a web address or a command, and a path as breadcrumbs.
 */

export type ActivityIcon = 'run' | 'edit' | 'read' | 'search' | 'web' | 'work';

export interface ToolLook {
  verb: string;
  icon: ActivityIcon;
}

/** Tool names (lower case) to their look; anything unknown is "Working". */
const LOOKS: { match: RegExp; look: ToolLook }[] = [
  { match: /^(bash|command|shell|terminal|exec|run)/, look: { verb: 'Running a command', icon: 'run' } },
  { match: /^(edit|write|multiedit|notebookedit|create|patch)/, look: { verb: 'Editing', icon: 'edit' } },
  { match: /^read/, look: { verb: 'Reading', icon: 'read' } },
  { match: /^(glob|grep|find|search|ls|list)/, look: { verb: 'Searching', icon: 'search' } },
  { match: /^web/, look: { verb: 'Looking online', icon: 'web' } },
];

export function toolLook(tool: string): ToolLook {
  const name = tool.trim().toLowerCase();
  return LOOKS.find((l) => l.match.test(name))?.look ?? { verb: 'Working', icon: 'work' };
}

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
