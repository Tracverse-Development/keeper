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
  | { kind: 'files'; id: string; title: string; items: { action: 'open' | 'create' | 'move' | 'edit' | 'delete' | 'find'; path: string; to?: string }[] };

export type PanelKind = Panel['kind'];

/** A piece of a panel the person pointed at; becomes the next question to the keeper. */
export interface PanelFocus {
  panelId: string;
  panelTitle: string;
  /** What was pointed at, in words ("row 7, column 8: 56", "step 3: Subtract 4 from both sides"). */
  what: string;
}

/** The follow-up the keeper is asked when the person points at a piece (pure; tested). */
export function focusQuestion(f: PanelFocus): string {
  return `About "${f.panelTitle}": explain ${f.what}. Show it step by step in a panel if that helps.`;
}
