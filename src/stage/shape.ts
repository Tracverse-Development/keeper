/**
 * Shaping panel content for drawing (pure; tested in shape.test.ts): paragraphs from a body,
 * an expression split around its symbols (so a formula part can light up its symbol), bar
 * heights for a chart, and numbers written the way a person reads them.
 */

/** Paragraphs split on blank lines; empty ones dropped. */
export function paragraphs(body: string): string[] {
  return body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

/** A run of an expression; `part` is the index of the formula part whose symbol it is. */
export interface ExpressionPiece {
  text: string;
  part?: number;
}

/**
 * Splits `expression` into runs, marking every occurrence of each part's symbol. Longer symbols
 * win over shorter ones that start at the same place ("r²" before "r"); empty symbols are ignored.
 */
export function splitExpression(expression: string, symbols: string[]): ExpressionPiece[] {
  const order = symbols
    .map((symbol, part) => ({ symbol, part }))
    .filter((s) => s.symbol.length > 0)
    .sort((a, b) => b.symbol.length - a.symbol.length);
  const pieces: ExpressionPiece[] = [];
  let plain = '';
  let i = 0;
  while (i < expression.length) {
    const hit = order.find((s) => expression.startsWith(s.symbol, i));
    if (!hit) {
      plain += expression[i];
      i += 1;
      continue;
    }
    if (plain) pieces.push({ text: plain });
    plain = '';
    pieces.push({ text: hit.symbol, part: hit.part });
    i += hit.symbol.length;
  }
  if (plain) pieces.push({ text: plain });
  return pieces;
}

/** Each bar's height as a share of the tallest (0..1); negatives and non-numbers draw as 0. */
export function barScale(values: number[]): number[] {
  const safe = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const top = Math.max(0, ...safe);
  return safe.map((v) => (top === 0 ? 0 : v / top));
}

/** Whole numbers as they are, others to at most two decimals ("3.14", "0.5"). */
export function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}
