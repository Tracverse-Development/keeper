/**
 * A keeper's draft of a change to one text file, as the core sends it (`sdk::drafts::DraftView`,
 * `sdk::drafts::commands::Saved`). The draft panel loads it by id; only Save writes the file.
 */

/** A piece of an edited line: its text, and whether it is what changed (a fixed word). */
export interface DraftPart {
  text: string;
  changed: boolean;
}

/** One line of the before/after view; `gap` stands for `skipped` unchanged lines folded away. */
export interface DraftLine {
  kind: 'same' | 'added' | 'removed' | 'gap';
  text: string;
  /** An edited line's pieces (a removed line answered by an added one). */
  parts?: DraftPart[];
  skipped?: number;
}

export interface DraftView {
  draft: string;
  name: string;
  /** The folder, with `~` for the home folder. */
  folder: string;
  path: string;
  why?: string | null;
  /** The proposed text, whole. */
  text: string;
  lines: DraftLine[];
  added: number;
  removed: number;
  /** The proposed text differs from the file. */
  changed: boolean;
}

/** A saved file, shown afterwards as a file panel (Open, Show in Finder). */
export interface DraftSaved {
  path: string;
  name: string;
  folder: string;
}
