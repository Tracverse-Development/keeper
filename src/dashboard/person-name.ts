/**
 * The person's first name, read from what the keeper knows ("Your name is Ada"), so the keeper
 * can say it (a touch reply, a greeting). Pure and tested.
 */
export function nameFromFacts(facts: { text: string; category: string }[]): string | null {
  const fact = facts.find((f) => f.category === 'identity' && /^your name is /i.test(f.text));
  return fact ? fact.text.replace(/^your name is /i, '').split(/\s+/)[0].replace(/[.,!]$/, '') : null;
}
