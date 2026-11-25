/**
 * Tests for the per-kind focus words and the follow-up question (pure).
 * Run: node --test --experimental-strip-types src/stage/focus.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barWhat, cardWhat, fileWhat, formulaPartWhat, quizWhyWhat, stepWhat, tableCellWhat } from './focus.ts';
import { focusQuestion } from './panel-spec.ts';

test('a table cell is named by its row header and column header', () => {
  const columns = ['×', '1', '2', '8'];
  const rows = [['1', '1', '2', '8'], ['7', '7', '14', '56']];
  assert.equal(tableCellWhat(columns, rows, 1, 3), 'row 7, column 8: 56');
});

test('a table cell outside the headers falls back to its numbers', () => {
  assert.equal(tableCellWhat(['a'], [['x', 'y']], 0, 1), 'row x, column 2: y');
  assert.equal(tableCellWhat([], [], 2, 0), 'row 3, column 1: ');
});

test('steps count from 1', () => {
  assert.equal(stepWhat(2, 'Subtract 4 from both sides'), 'step 3: Subtract 4 from both sides');
});

test('formula parts, cards, files', () => {
  assert.equal(formulaPartWhat('r', 'A = πr²', 'the radius'), 'the r in A = πr² (the radius)');
  assert.equal(cardWhat('Variables'), 'the card Variables');
  assert.equal(fileWhat('move', '~/Downloads/a.pdf'), 'the move of ~/Downloads/a.pdf');
});

test('"Why?" names the right answer', () => {
  assert.equal(quizWhyWhat('What is x if 2x = 6?', ['2', '3', '4'], 1), 'why the answer to What is x if 2x = 6? is 3');
});

test('a bar carries its value and unit', () => {
  assert.equal(barWhat('Monday', 42, ' min'), 'the bar Monday (42 min)');
  assert.equal(barWhat('Pi', 3.14159), 'the bar Pi (3.14)');
});

test('focusQuestion asks about exactly the piece, in the panel', () => {
  const q = focusQuestion({ panelId: 'p1', panelTitle: 'Times table', what: 'row 7, column 8: 56' });
  assert.equal(q, 'About "Times table": explain row 7, column 8: 56. Show it step by step in a panel if that helps.');
});
