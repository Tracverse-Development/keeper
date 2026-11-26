/**
 * How fast and how much: a turn's timing and cost, and the month's spending on cloud minds.
 * Shapes mirrored from the core (`assistant::Timings`, `commands::Spending`).
 */

/** One turn's timing in milliseconds (`assistant::Timings`). */
export interface Timings {
  recallMs: number;
  /** The person first saw something (the reply ready, or a panel). */
  firstMs: number | null;
  /** The first Stage panel arrived (absent or null when the answer has none). */
  panelMs?: number | null;
  thinkMs: number;
  totalMs: number;
  source: string;
  /** What the engine says the answer cost, in dollars at its own prices (absent: none reported). */
  costUsd?: number | null;
}

/** This month's spending on cloud minds (`commands::Spending`). */
export interface Spending {
  usd: number;
  calls: number;
  capUsd: number;
  reached: boolean;
}

/** One version's changelog entry (`updater::whats_new::Entry`): its sections in order. */
export interface ChangeEntry {
  version: string;
  date: string;
  sections: [string, string[]][];
}
