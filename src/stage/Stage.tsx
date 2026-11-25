/**
 * The Stage: what the keeper SHOWS, drawn inside Keeper (never a browser page). It takes the
 * area right of the character (the left third stays the character's; the dock stays at the
 * bottom); under 1000 px wide the panels stack full width above the dock. The live activity feed
 * sits on top while the agent works; panels arrive staggered on glass cards, each closable, and
 * pointing at any piece calls `onFocus` so the window can ask the keeper about exactly that.
 * Panels the person works IN (a checklist, a form, an approval, flashcards, a quiz, the facts
 * list) report what was done through `onAction`, which the window hands to the core.
 *
 * Mounted by the dashboard: `<Stage panels activity working onFocus onAction onClose keeperName … />`.
 */
import { useEffect, useRef, useState } from 'react';

import { ActivityPanel } from './ActivityPanel.tsx';
import { Icon } from './icons.tsx';
import { PanelCard } from './PanelCard.tsx';
import { SceneNav, type SceneTab } from './SceneNav.tsx';
import type { Panel, PanelAction, PanelFocus } from './panel-spec.ts';
import './stage.css';

export interface StageProps {
  panels: Panel[];
  activity: { tool: string; detail: string }[];
  working: boolean;
  onFocus: (f: PanelFocus) => void;
  /** Something the person did in a panel (ticked, submitted, answered, approved, forgot, pinned). */
  onAction: (a: PanelAction) => void;
  onClose: () => void;
  keeperName: string;
  /** The chat's scenes (one per answer that showed panels) and the one on screen. */
  scenes: SceneTab[];
  current: number;
  onScene: (index: number) => void;
  /** The turn's phase and engine name, for the working pipeline. */
  phase?: string | null;
  mind?: string;
}

/** Whether a panel takes the full width of the stage grid (the rest pair up two by two). */
function isWide(panel: Panel): boolean {
  switch (panel.kind) {
    case 'cards': return panel.cards.length > 2;
    case 'facts': return panel.facts.length > 4;
    case 'sliders': return panel.variables.length > 2;
    case 'table': case 'steps': case 'files': case 'text': case 'chart':
    case 'diagram': case 'timeline': case 'folder': case 'flashcards': case 'approval':
      return true;
    default: return false;
  }
}

export function Stage({ panels, activity, working, onFocus, onAction, onClose, keeperName, scenes, current, onScene, phase, mind }: StageProps) {
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const scroller = useRef<HTMLDivElement>(null);

  // Keyed on the ids, not the array, so a parent that rebuilds the array each render keeps
  // closed panels closed. A new answer brings new ids: all open again, scrolled to the top.
  const ids = panels.map((p) => p.id).join('\n');
  useEffect(() => {
    setClosed(new Set());
    scroller.current?.scrollTo({ top: 0 });
  }, [ids]);

  const visible = panels.filter((p) => !closed.has(p.id));
  const showActivity = working || activity.length > 0;
  const allClosed = panels.length > 0 && visible.length === 0;

  // Closing the last panel (with no activity to watch) dismisses the stage.
  useEffect(() => {
    if (allClosed && !showActivity) onClose();
  }, [allClosed, showActivity, onClose]);

  const closePanel = (id: string) => setClosed((prev) => new Set(prev).add(id));

  return (
    <aside className="stage-area" aria-label={`${keeperName}'s stage`}>
      <header className="stage-head">
        <p className="eyebrow">{keeperName} is showing you</p>
        <SceneNav scenes={scenes} current={current} onScene={onScene} />
        <button type="button" className="pill pill-button stage-dismiss" onClick={onClose}>
          <Icon name="close" size={13} /> Close
        </button>
      </header>
      <div className="stage-scroll" ref={scroller}>
        {showActivity && <ActivityPanel activity={activity} working={working} keeperName={keeperName} phase={phase} mind={mind} />}
        <div className="stage-grid">
          {visible.map((panel, i) => (
            <PanelCard key={panel.id} panel={panel} index={i} wide={isWide(panel)} onFocus={onFocus} onAction={onAction} onClose={closePanel} />
          ))}
        </div>
      </div>
    </aside>
  );
}
