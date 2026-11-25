/** Step 6: a summary of what was set up, then the character's first appearance. */
import { useState } from 'react';

import { sentence } from '../../kernel/ipc';
import type { InstallerChoices } from '../InstallerScreen';
import { PanelActions } from '../InstallerScreen';

const MIND_WORDS: Record<string, string> = { claude: 'Claude Code', codex: 'Codex', gemini: 'the Gemini CLI', ollama: 'a local model', hermes: 'Hermes, guarded by Blackbox', reflex: 'the built-in mind' };

export function MeetPanel({ choices, onFinish, onBack }: { choices: InstallerChoices; onFinish: () => Promise<void>; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = choices.assistantName.trim() || 'Umoja';
  const go = async () => {
    setBusy(true);
    try {
      await onFinish();
    } catch (e) {
      setError(sentence(e));
      setBusy(false);
    }
  };
  return (
    <>
      <p className="eyebrow">Ready</p>
      <h2>{name} is ready to meet you.</h2>
      <ul className="summary">
        <li>
          <span className="dot ok" /> Memory on your DKG node {choices.node?.status.version ? `(V${choices.node.status.version})` : ''}
        </li>
        <li>
          <span className="dot ok" /> Private graph <span className="mono">{choices.graph?.graphId}</span>
        </li>
        <li>
          <span className="dot ok" /> Thinking with {MIND_WORDS[choices.brain] ?? choices.brain}
        </li>
        <li>
          <span className="dot ok" /> Speaking as {choices.voice}
        </li>
      </ul>
      <p className="lead">Try saying "My name is…", "I love…", "Remind me to… in 5 minutes", or "What do you know about me?"</p>
      {error && <p className="error-line">{error}</p>}
      <PanelActions onBack={onBack} onNext={go} nextLabel={`Meet ${name}`} busy={busy} />
    </>
  );
}
