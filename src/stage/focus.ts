/**
 * The words for "what was pointed at" on each panel kind (pure; tested in focus.test.ts).
 * Each renderer calls one of these when the person clicks a piece; the Stage wraps the words in
 * a `PanelFocus` and the window turns that into the follow-up question (`focusQuestion`).
 */
import { formatValue } from './shape.ts';

/** A table cell, named by its row header (the row's first cell) and its column header. */
export function tableCellWhat(columns: string[], rows: string[][], row: number, col: number): string {
  const rowName = rows[row]?.[0] ?? String(row + 1);
  const colName = columns[col] ?? String(col + 1);
  return `row ${rowName}, column ${colName}: ${rows[row]?.[col] ?? ''}`;
}

/** A step, numbered from 1 as the person sees it. */
export function stepWhat(index: number, label: string): string {
  return `step ${index + 1}: ${label}`;
}

export function formulaPartWhat(symbol: string, expression: string, meaning: string): string {
  return `the ${symbol} in ${expression} (${meaning})`;
}

export function cardWhat(title: string): string {
  return `the card ${title}`;
}

/** "Why?" on a quiz always asks about the right answer, whatever the person chose. */
export function quizWhyWhat(question: string, choices: string[], answer: number): string {
  return `why the answer to ${question} is ${choices[answer] ?? ''}`;
}

export function barWhat(label: string, value: number, unit = ''): string {
  return `the bar ${label} (${formatValue(value)}${unit})`;
}

export function fileWhat(action: string, path: string): string {
  return `the ${action} of ${path}`;
}
