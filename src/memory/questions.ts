/**
 * The pure decisions behind the Questions tab (tested in questions.test.ts): how the core's
 * question catalog is grouped for display, which inputs a question needs and their defaults,
 * whether the inputs are ready to send, and how an answer is laid out as a table.
 * The validation here is UX only; the core (`memory/catalog.rs`) validates again and is the guard.
 */
import type { QuestionInfo, QuestionParam } from '../kernel/ipc';

/** The order groups appear in; any group the core adds later follows these, in catalog order. */
export const GROUP_ORDER = ['Knowledge', 'Conversations', 'Actions', 'Reminders', 'About me'] as const;

/** The fact categories (mirrors `CATEGORIES` in `src-tauri/src/memory/catalog.rs`). */
export const CATEGORIES = ['identity', 'preference', 'person', 'place', 'work', 'health', 'schedule', 'general'] as const;

export const DAYS_MIN = 1;
export const DAYS_MAX = 3650;
export const DAYS_DEFAULT = 7;

export interface QuestionGroup {
  group: string;
  questions: QuestionInfo[];
}

/** Group the catalog by `group`, known groups first in `GROUP_ORDER`, questions kept in catalog order. */
export function groupQuestions(catalog: QuestionInfo[]): QuestionGroup[] {
  const byGroup = new Map<string, QuestionInfo[]>();
  for (const q of catalog) byGroup.set(q.group, [...(byGroup.get(q.group) ?? []), q]);
  const rank = (g: string) => {
    const i = (GROUP_ORDER as readonly string[]).indexOf(g);
    return i === -1 ? GROUP_ORDER.length : i;
  };
  return [...byGroup.keys()]
    .map((group, seen) => ({ group, seen }))
    .sort((a, b) => rank(a.group) - rank(b.group) || a.seen - b.seen)
    .map(({ group }) => ({ group, questions: byGroup.get(group)! }));
}

/** The starting value of each input a question takes (a chat starts at the most recent one, if any). */
export function defaultArgs(params: QuestionParam[], firstChat?: string): Record<string, string> {
  const args: Record<string, string> = {};
  for (const p of params) {
    if (p === 'days') args.days = String(DAYS_DEFAULT);
    if (p === 'category') args.category = CATEGORIES[0];
    if (p === 'chat') args.chat = firstChat ?? '';
    if (p === 'skill') args.skill = '';
  }
  return args;
}

/** Why the inputs cannot be sent yet, in a sentence, or null when they are ready. */
export function argsProblem(params: QuestionParam[], args: Record<string, string>): string | null {
  for (const p of params) {
    const value = (args[p] ?? '').trim();
    if (p === 'days') {
      const days = Number(value);
      if (!/^\d+$/.test(value) || days < DAYS_MIN || days > DAYS_MAX) return `Choose a number of days from ${DAYS_MIN} to ${DAYS_MAX}.`;
    }
    if (p === 'category' && !(CATEGORIES as readonly string[]).includes(value)) return 'Choose an area.';
    if (p === 'chat' && !value) return 'Choose a chat.';
    if (p === 'skill' && !/^[A-Za-z:-]{1,40}$/.test(value)) return 'Type a skill name, like open-app or agent:Bash.';
  }
  return null;
}

/** The table's columns: every key the rows carry, in the order they first appear. */
export function columns(rows: Record<string, string>[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) seen.add(key);
  return [...seen];
}

/** A query as people read it: the PREFIX lines dropped (they are the same for every question). */
export function withoutPrefixes(sparql: string): string {
  return sparql.replace(/PREFIX\s+\S*:\s*<[^>]*>\s*/g, '').trim();
}

/** A cell as plain text: full IRIs keep their last segment, so a row stays readable. */
export function cellText(value: string | undefined): string {
  if (value === undefined) return '';
  const iri = /^(?:urn:|https?:\/\/)\S+$/.test(value) ? value.split(/[#/:]/).filter(Boolean).pop() : undefined;
  return iri ?? value;
}
