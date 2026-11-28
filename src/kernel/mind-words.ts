/**
 * What answered, in words a person reads: the engines by their names ("Claude Code", "a local
 * model") and the core's own sources ("built-in mind", "instant answer", "from memory"). One
 * table for the pipeline line, the speed line and the Memory drawer (tested by `mind-words.test.ts`).
 */
const NAMES: Readonly<Record<string, string>> = {
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini',
  hermes: 'Hermes',
  ollama: 'a local model',
  reflex: 'built-in mind',
  instant: 'instant answer',
  cache: 'from memory',
};

/** The name of what answered (`claude`, `reflex`, `instant`…); an unknown id is shown as it is, "" when none. */
export function mindName(id: string | undefined): string {
  return id ? NAMES[id] ?? id : '';
}
