/**
 * The Stage panel contract: what an engine may ask Keeper to SHOW, inside Keeper, instead of
 * building a web page or a file. The core validates and caps every panel (`src-tauri/src/stage/`; re-exported for the renderers by `src/stage/panel-spec.ts`)
 * before the window sees it; renderers draw plain text only (never HTML). Mirrors the Rust enum
 * `stage::Panel` (serde tag "kind").
 *
 * Interaction: every clickable piece (a table cell, a step, a card, a chart bar, a formula part,
 * a quiz choice) becomes a `PanelFocus`, which the window turns into a follow-up turn that asks
 * the keeper about exactly that piece, in the same chat.
 */
export type Panel =
  | { kind: 'text'; id: string; title: string; body: string; bullets?: string[] }
  | { kind: 'table'; id: string; title: string; caption?: string; columns: string[]; rows: string[][]; highlight?: { row: number; col: number }[] }
  | { kind: 'steps'; id: string; title: string; steps: { label: string; detail?: string; math?: string }[] }
  | { kind: 'formula'; id: string; title: string; expression: string; parts: { symbol: string; meaning: string }[] }
  | { kind: 'cards'; id: string; title: string; cards: { title: string; body: string; emoji?: string }[] }
  | { kind: 'quiz'; id: string; title: string; question: string; choices: string[]; answer: number; explain: string }
  | { kind: 'chart'; id: string; title: string; labels: string[]; values: number[]; unit?: string }
  | { kind: 'files'; id: string; title: string; items: { action: 'open' | 'create' | 'move' | 'edit' | 'delete' | 'find'; path: string; to?: string }[] }
  // ---- added in 0.6: diagrams, time, live work, what-ifs, practice, and panels you work IN ----
  | { kind: 'diagram'; id: string; title: string; nodes: { id: string; label: string; group?: string }[]; edges: { from: string; to: string; label?: string }[] }
  | { kind: 'timeline'; id: string; title: string; events: { when: string; title: string; detail?: string }[] }
  | { kind: 'folder'; id: string; title: string; path: string; entries: { name: string; kind: 'file' | 'folder'; change?: 'added' | 'removed' | 'moved' | 'kept'; to?: string }[] }
  | { kind: 'sliders'; id: string; title: string; expression: string; resultLabel: string; unit?: string; variables: { name: string; label: string; min: number; max: number; step: number; value: number }[] }
  | { kind: 'flashcards'; id: string; title: string; cards: { front: string; back: string }[] }
  | { kind: 'agenda'; id: string; title: string; items: { time?: string; title: string; detail?: string; kind?: 'event' | 'reminder' | 'task' }[] }
  | { kind: 'checklist'; id: string; title: string; items: { id: string; text: string; done: boolean }[] }
  | { kind: 'form'; id: string; title: string; fields: { id: string; label: string; kind: 'text' | 'number' | 'choice' | 'date'; choices?: string[]; placeholder?: string }[]; submit: string }
  | { kind: 'approval'; id: string; title: string; summary: string; steps: { action: string; target: string; detail?: string }[]; token: string }
  | { kind: 'facts'; id: string; title: string; facts: { id: string; text: string; category: string }[] }
  // ---- added in 0.9: research, live dashboards, things to watch, visit or open ----
  | { kind: 'sources'; id: string; title: string; items: { title: string; url: string; note?: string }[] }
  | { kind: 'live'; id: string; title: string; metrics: ('cpu' | 'memory' | 'network' | 'disk' | 'apps')[] }
  | { kind: 'media'; id: string; title: string; url: string; caption?: string }
  | { kind: 'web'; id: string; title: string; url: string; summary?: string }
  | { kind: 'file'; id: string; title: string; path: string; note?: string };

export type PanelKind = Panel['kind'];

/** A piece of a panel the person pointed at; becomes the next question to the keeper. */
export interface PanelFocus {
  panelId: string;
  panelTitle: string;
  /** What was pointed at, in words ("row 7, column 8: 56", "step 3: Subtract 4 from both sides"). */
  what: string;
}

/**
 * Something the person DID in a panel that the keeper should know about (written back to the DKG
 * by the core's `stage_action`): a ticked item, a submitted form, a quiz answer, a flashcard
 * marked known or not, an approved or denied plan, a fact forgotten or pinned.
 */
export type PanelAction =
  | { type: 'check'; panelId: string; panelTitle: string; itemId: string; text: string; done: boolean }
  | { type: 'submit'; panelId: string; panelTitle: string; values: Record<string, string> }
  | { type: 'quiz'; panelId: string; question: string; correct: boolean }
  | { type: 'card'; panelId: string; front: string; known: boolean }
  | { type: 'approve' | 'deny'; token: string }
  | { type: 'forget' | 'pin'; factId: string };

/** The follow-up the keeper is asked when the person points at a piece (pure; tested). */
export function focusQuestion(f: PanelFocus): string {
  return `About "${f.panelTitle}": explain ${f.what}. Show it step by step in a panel if that helps.`;
}
