/** Keeper's file viewer (core `explorer`): the shapes the core sends. */

export interface FileEntry {
  name: string;
  path: string;
  folder: boolean;
  size: number;
  /** RFC 3339, UTC. */
  modified: string;
}

export interface FileListing {
  path: string;
  /** "~/Documents/Taxes". */
  shown: string;
  parent: string | null;
  entries: FileEntry[];
  total: number;
  /** The file asked for, when a file (not a folder) was asked for. */
  selected: string | null;
}

export type FilePreview =
  | { kind: 'picture'; name: string; path: string; src: string }
  | { kind: 'media'; name: string; path: string; video: boolean }
  | { kind: 'text'; name: string; path: string; text: string; editable: boolean }
  | { kind: 'document'; name: string; path: string; src: string | null; text: string | null }
  | { kind: 'other'; name: string; path: string; size: number };
