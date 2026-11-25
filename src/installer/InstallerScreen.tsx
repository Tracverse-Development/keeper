/**
 * The first-run installer: an animated Umoja Ark stage on the left, one step at a time on the
 * right. Each step is its own panel (`panels/`); this file holds the shared choices and moves
 * between steps. Back always returns to the previous step with its choices kept.
 */
import { useEffect, useState } from 'react';

import { core, type EngineId, type FoundNode, type GraphReady, type Scan } from '../kernel/ipc';
import { Mark } from '../kernel/Mark';
import { GraphPanel } from './panels/GraphPanel';
import { MeetPanel } from './panels/MeetPanel';
import { MindPanel } from './panels/MindPanel';
import { NodePanel } from './panels/NodePanel';
import { VoicePanel } from './panels/VoicePanel';
import { WelcomePanel } from './panels/WelcomePanel';
import { STEPS, suggestedMind } from './steps';
import './installer.css';

export interface InstallerChoices {
  scan: Scan | null;
  node: FoundNode | null;
  graph: GraphReady | null;
  assistantName: string;
  brain: EngineId;
  ollamaModel: string;
  voice: string;
}

export function InstallerScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<InstallerChoices>({ scan: null, node: null, graph: null, assistantName: 'Keeper', brain: 'reflex', ollamaModel: '', voice: 'Samantha' });
  const update = (patch: Partial<InstallerChoices>) => setChoices((c) => ({ ...c, ...patch }));

  // Look around once, in the background, while the person reads the welcome.
  const rescan = () =>
    core.scan().then((scan) => {
      setChoices((c) => {
        const mind = c.scan ? { brain: c.brain, model: c.ollamaModel } : suggestedMind(scan);
        return { ...c, scan, node: scan.node ?? c.node, brain: mind.brain, ollamaModel: mind.model };
      });
      return scan;
    });
  useEffect(() => {
    rescan();
  }, []);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const finish = async () => {
    await core.finishSetup(choices.brain, choices.ollamaModel, choices.voice);
    onDone();
  };

  const id = STEPS[step].id;
  return (
    <div className="installer">
      <section className="installer-stage" aria-hidden>
        <div className="stage-glow" />
        <div className="stage-rings">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ animationDelay: `${i * 1.6}s` }} />
          ))}
        </div>
        <div className="stage-motes">
          {Array.from({ length: 22 }, (_, i) => (
            <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.83) % 9}s`, animationDuration: `${9 + (i % 5) * 2}s` }} />
          ))}
        </div>
        <div className={`stage-mark ${step > 0 ? 'is-small' : ''}`}>
          <Mark size={step > 0 ? 120 : 190} />
        </div>
        <div className="stage-words">
          <h1>Keeper</h1>
          <p>Your assistant. Your memory. Your own DKG node.</p>
        </div>
        <svg className="stage-waves" viewBox="0 0 1200 160" preserveAspectRatio="none">
          <path className="wave w1" d="M0 90 C 150 60, 300 120, 450 90 S 750 60, 900 90 S 1100 120, 1200 90 L1200 160 L0 160 Z" />
          <path className="wave w2" d="M0 110 C 200 85, 350 135, 600 110 S 950 85, 1200 110 L1200 160 L0 160 Z" />
        </svg>
      </section>

      <section className="installer-panel">
        <ol className="stepper" aria-label="Setup steps">
          {STEPS.map((s, i) => (
            <li key={s.id} className={i === step ? 'is-current' : i < step ? 'is-done' : ''}>
              <span className="stepper-dot">{i < step ? '✓' : i + 1}</span>
              <span className="stepper-label">{s.title}</span>
            </li>
          ))}
        </ol>
        <div className="panel-body" key={id}>
          {id === 'welcome' && <WelcomePanel onNext={next} />}
          {id === 'node' && <NodePanel choices={choices} update={update} rescan={rescan} onNext={next} onBack={back} />}
          {id === 'graph' && <GraphPanel choices={choices} update={update} onNext={next} onBack={back} />}
          {id === 'mind' && <MindPanel choices={choices} update={update} onNext={next} onBack={back} />}
          {id === 'voice' && <VoicePanel choices={choices} update={update} onNext={next} onBack={back} />}
          {id === 'meet' && <MeetPanel choices={choices} onFinish={finish} onBack={back} />}
        </div>
      </section>
    </div>
  );
}

/** The shared Back / Continue row every panel ends with. */
export function PanelActions({ onBack, onNext, nextLabel = 'Continue', canNext = true, busy = false }: { onBack?: () => void; onNext: () => void; nextLabel?: string; canNext?: boolean; busy?: boolean }) {
  return (
    <div className="panel-actions">
      {onBack ? (
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
      ) : (
        <span />
      )}
      <button type="button" className="btn btn-primary" onClick={onNext} disabled={!canNext || busy}>
        {busy && <span className="spinner" />}
        {nextLabel}
      </button>
    </div>
  );
}
