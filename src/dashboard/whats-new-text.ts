/**
 * A changelog line as the What's new sheet shows it: the fix numbers dropped (they point into
 * FIXLOG.md, which the person never reads) and `**bold**` split out so the lead-in is drawn bold
 * instead of showing its asterisks. Pure; tested in `whats-new-text.test.ts`.
 */

/** One run of the line's text; `bold` for what the changelog wrote between `**`. */
export interface TextRun {
  text: string;
  bold: boolean;
}

/** The line's runs, fix numbers removed. */
export function changeLine(line: string): TextRun[] {
  const clean = line.replace(/\s*\(FIX-\d+(?:,\s*FIX-\d+)*\)/g, '');
  return clean
    .split(/(\*\*[^*]+\*\*)/)
    .filter((part) => part !== '')
    .map((part) => (part.startsWith('**') && part.endsWith('**') && part.length > 4 ? { text: part.slice(2, -2), bold: true } : { text: part, bold: false }));
}
