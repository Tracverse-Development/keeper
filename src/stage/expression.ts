/**
 * A SAFE arithmetic evaluator for the what-if (sliders) panel (pure; tested in expression.test.ts).
 * The expression comes from an engine, so it is parsed here by a small recursive-descent parser
 * and never handed to `eval` or `Function`. It understands numbers, the panel's variable names,
 * + - * / ^ % (also the typed − × ÷), parentheses, unary minus and the functions round, floor,
 * ceil, min, max, sqrt and abs. Anything else (a property access, a call to an unknown function,
 * brackets, a non-finite result) is refused with `{ ok: false }`.
 *
 * Precedence, lowest first: + -, then * / %, then unary minus, then ^ (right-associative), so
 * -2^2 = -4 and 2^3^2 = 512 as in written maths.
 *
 * Usage: `evaluate('weekly * weeks * (1 + rate/100)', { weekly: 50, weeks: 52, rate: 3 })`.
 */

export type Evaluation = { ok: true; value: number } | { ok: false; error: string };

type Token = { type: 'num'; value: number } | { type: 'name'; value: string } | { type: 'op'; value: string };

/** Longest expression we will read (an engine sends short formulas; this bounds the work). */
const MAX_LENGTH = 400;
/** Deepest nesting of parentheses and unary signs before we refuse (bounds the recursion). */
const MAX_DEPTH = 40;

const FUNCTIONS = new Map<string, { arity: [number, number]; apply: (args: number[]) => number }>([
  ['round', { arity: [1, 1], apply: ([x]) => Math.round(x) }],
  ['floor', { arity: [1, 1], apply: ([x]) => Math.floor(x) }],
  ['ceil', { arity: [1, 1], apply: ([x]) => Math.ceil(x) }],
  ['sqrt', { arity: [1, 1], apply: ([x]) => Math.sqrt(x) }],
  ['abs', { arity: [1, 1], apply: ([x]) => Math.abs(x) }],
  ['min', { arity: [1, 20], apply: (xs) => Math.min(...xs) }],
  ['max', { arity: [1, 20], apply: (xs) => Math.max(...xs) }],
]);

/** Typed maths signs a person (or a model) may use, mapped to the operators we parse. */
const SIGN_ALIASES: Record<string, string> = { '−': '-', '×': '*', '·': '*', '÷': '/' };
const OPERATORS = new Set(['+', '-', '*', '/', '%', '^', '(', ')', ',']);

class Refused extends Error {}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = SIGN_ALIASES[source[i]] ?? source[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    const number = /^(\d+\.?\d*|\.\d+)/.exec(source.slice(i));
    if (number) {
      const next = source[i + number[0].length] ?? '';
      if (/[A-Za-z_.]/.test(next)) throw new Refused(`unexpected "${next}"`);
      tokens.push({ type: 'num', value: Number(number[0]) });
      i += number[0].length;
      continue;
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i));
    if (name) {
      tokens.push({ type: 'name', value: name[0] });
      i += name[0].length;
      continue;
    }
    if (OPERATORS.has(ch)) { tokens.push({ type: 'op', value: ch }); i += 1; continue; }
    throw new Refused(`unexpected "${ch}"`);
  }
  return tokens;
}

/** One parse over a token list; each method reads one grammar level. */
class Parser {
  private at = 0;
  private depth = 0;
  private tokens: Token[];
  private vars: Map<string, number>;
  constructor(tokens: Token[], vars: Map<string, number>) {
    this.tokens = tokens;
    this.vars = vars;
  }

  run(): number {
    const value = this.sum();
    if (this.at < this.tokens.length) throw new Refused('unexpected input after the end');
    return value;
  }

  private peekOp(...ops: string[]): string | null {
    const t = this.tokens[this.at];
    return t?.type === 'op' && ops.includes(t.value) ? t.value : null;
  }

  private expectOp(op: string) {
    if (!this.peekOp(op)) throw new Refused(`expected "${op}"`);
    this.at += 1;
  }

  private nest<T>(read: () => T): T {
    this.depth += 1;
    if (this.depth > MAX_DEPTH) throw new Refused('nested too deeply');
    try { return read(); } finally { this.depth -= 1; }
  }

  private sum(): number {
    let value = this.product();
    for (let op = this.peekOp('+', '-'); op; op = this.peekOp('+', '-')) {
      this.at += 1;
      const right = this.product();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  }

  private product(): number {
    let value = this.unary();
    for (let op = this.peekOp('*', '/', '%'); op; op = this.peekOp('*', '/', '%')) {
      this.at += 1;
      const right = this.unary();
      value = op === '*' ? value * right : op === '/' ? value / right : value % right;
    }
    return value;
  }

  private unary(): number {
    const sign = this.peekOp('+', '-');
    if (!sign) return this.power();
    this.at += 1;
    return this.nest(() => (sign === '-' ? -this.unary() : this.unary()));
  }

  private power(): number {
    const base = this.primary();
    if (!this.peekOp('^')) return base;
    this.at += 1;
    return base ** this.nest(() => this.unary());
  }

  private primary(): number {
    const t = this.tokens[this.at];
    if (!t) throw new Refused('the expression ends too soon');
    this.at += 1;
    if (t.type === 'num') return t.value;
    if (t.type === 'op') {
      if (t.value !== '(') throw new Refused(`unexpected "${t.value}"`);
      const inner = this.nest(() => this.sum());
      this.expectOp(')');
      return inner;
    }
    if (this.peekOp('(')) return this.call(t.value);
    const value = this.vars.get(t.value);
    if (value === undefined) throw new Refused(`unknown name "${t.value}"`);
    return value;
  }

  private call(name: string): number {
    const fn = FUNCTIONS.get(name);
    if (!fn) throw new Refused(`unknown function "${name}"`);
    this.expectOp('(');
    const args = [this.nest(() => this.sum())];
    while (this.peekOp(',')) {
      this.at += 1;
      args.push(this.nest(() => this.sum()));
    }
    this.expectOp(')');
    if (args.length < fn.arity[0] || args.length > fn.arity[1]) throw new Refused(`${name} takes a different number of values`);
    return fn.apply(args);
  }
}

/** Evaluates `expression` with `variables`; never throws. Variable names must be plain words. */
export function evaluate(expression: string, variables: Record<string, number>): Evaluation {
  try {
    if (expression.length > MAX_LENGTH) throw new Refused('too long');
    // A Map, not the object: a name like "constructor" must never reach the prototype chain.
    const vars = new Map<string, number>();
    for (const [name, value] of Object.entries(variables)) {
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && Number.isFinite(value) && !FUNCTIONS.has(name)) vars.set(name, value);
    }
    const tokens = tokenize(expression);
    if (tokens.length === 0) throw new Refused('empty');
    const value = new Parser(tokens, vars).run();
    if (!Number.isFinite(value)) throw new Refused('the result is not a number');
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof Refused ? e.message : 'cannot calculate' };
  }
}
