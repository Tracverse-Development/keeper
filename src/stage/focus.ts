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

export function nodeWhat(label: string): string {
  return `the node ${label}`;
}

export function momentWhat(title: string, when: string): string {
  return `the moment ${title} (${when})`;
}

/** A folder entry with its change: "the moved file a.pdf in ~/Downloads (to Documents)". */
export function folderEntryWhat(entry: { name: string; kind: 'file' | 'folder'; change?: string; to?: string }, path: string): string {
  const change = entry.change && entry.change !== 'kept' ? `${entry.change} ` : '';
  const to = entry.change === 'moved' && entry.to ? ` (to ${entry.to})` : '';
  return `the ${change}${entry.kind} ${entry.name} in ${path}${to}`;
}

/** A what-if at its current values: "why Total = 2,678 when weekly = 50, weeks = 52 (weekly * weeks)". */
export function slidersWhat(resultLabel: string, result: string, expression: string, values: { label: string; value: number }[]): string {
  const at = values.map((v) => `${v.label} = ${formatValue(v.value)}`).join(', ');
  return `why ${resultLabel} is ${result} when ${at} (${expression})`;
}

export function agendaWhat(item: { time?: string; title: string; kind?: string }): string {
  return `the ${item.kind ?? 'item'} ${item.title}${item.time ? ` at ${item.time}` : ''}`;
}
