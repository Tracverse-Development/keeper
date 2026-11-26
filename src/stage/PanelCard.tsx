/**
 * One panel on its glass card: a kind label, the title, one line on what you can do with it
 * (`panel-help.ts`), a close button, the renderer, and a
 * short "Asking about …" line after the person points at a piece. Closing plays the exit
 * animation first, then tells the Stage.
 */
import { useEffect, useState } from 'react';

import { Icon } from './icons.tsx';
import type { Panel, PanelAction, PanelFocus, PanelKind } from './panel-spec.ts';
import { PANEL_HELP } from './panel-help.ts';
import { PanelBody } from './panels/PanelBody.tsx';
import { stagger } from './stagger.ts';

const KIND_LABELS: Record<PanelKind, string> = {
  text: 'Notes', table: 'Table', steps: 'Step by step', formula: 'Formula',
  cards: 'Ideas', quiz: 'Quick check', chart: 'Chart', files: 'Files',
  diagram: 'Diagram', timeline: 'Timeline', folder: 'Folder', sliders: 'What if', flashcards: 'Practice',
  agenda: 'Agenda', checklist: 'Checklist', form: 'Fill this in', approval: 'Plan to approve', facts: 'What I know',
  sources: 'Sources', live: 'Live', media: 'Watch', web: 'Visit', file: 'File',
};

/** How long the "Asking about …" line stays after a click. */
const ASKED_MS = 2600;

interface Props {
  panel: Panel;
  index: number;
  wide: boolean;
  onFocus: (f: PanelFocus) => void;
  onAction: (a: PanelAction) => void;
  onClose: (id: string) => void;
}

export function PanelCard({ panel, index, wide, onFocus, onAction, onClose }: Props) {
  const [leaving, setLeaving] = useState(false);
  const [asked, setAsked] = useState<string | null>(null);

  useEffect(() => {
    if (!asked) return;
    const timer = window.setTimeout(() => setAsked(null), ASKED_MS);
    return () => window.clearTimeout(timer);
  }, [asked]);

  const pick = (what: string) => {
    setAsked(what);
    onFocus({ panelId: panel.id, panelTitle: panel.title, what });
  };

  const names = ['panel-card', 'glass', `is-${panel.kind}`];
  if (wide) names.push('is-wide');
  if (leaving) names.push('is-leaving');

  return (
    <section className={names.join(' ')} style={stagger(index)} aria-label={panel.title}
      onAnimationEnd={(e) => { if (leaving && e.target === e.currentTarget) onClose(panel.id); }}>
      <span className="panel-sheen" aria-hidden="true" />
      <header className="panel-head">
        <div>
          <p className="eyebrow panel-kind">{KIND_LABELS[panel.kind]}</p>
          <h2 className="panel-title">{panel.title}</h2>
          <p className="panel-help muted small">{PANEL_HELP[panel.kind]}</p>
        </div>
        <button type="button" className="panel-close" aria-label={`Close ${panel.title}`} onClick={() => setLeaving(true)}>
          <Icon name="close" size={15} />
        </button>
      </header>
      <PanelBody panel={panel} onPick={pick} onAction={onAction} />
      <p className={asked ? 'panel-asked is-on' : 'panel-asked'} aria-live="polite">
        {asked && <><Icon name="ask" size={14} /> Asking about {asked}</>}
      </p>
    </section>
  );
}
