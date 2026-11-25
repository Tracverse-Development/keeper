/**
 * Step 4: which engine thinks. Agent apps already on this Mac (Claude Code, Codex, Gemini,
 * Hermes) use the person's own subscriptions; a local model or the built-in mind stay on the
 * device. The memory stays in the DKG graph whichever is chosen, and it can be changed any time.
 */
import { EnginePicker } from '../../settings/EnginePicker';
import type { InstallerChoices } from '../InstallerScreen';
import { PanelActions } from '../InstallerScreen';

interface Props {
  choices: InstallerChoices;
  update: (p: Partial<InstallerChoices>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function MindPanel({ choices, update, onNext, onBack }: Props) {
  return (
    <>
      <p className="eyebrow">Mind</p>
      <h2>Choose how your keeper thinks.</h2>
      <p className="lead">Whatever you choose, its memory stays in your DKG graph. You can switch engines any time, in Settings or just by saying "switch your brain to Claude".</p>
      <EnginePicker value={choices.brain} model={choices.model} onPick={(brain, model) => update({ brain, model })} />
      <PanelActions onBack={onBack} onNext={onNext} canNext={choices.brain !== 'ollama' || Boolean(choices.model)} />
    </>
  );
}
