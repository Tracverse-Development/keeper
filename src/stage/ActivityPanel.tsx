/**
 * What the keeper is doing on the computer, live, in words a person would say ("Looking in
 * Applications", "Moving report.pdf to Documents"), never as commands: the step being done now
 * plays large with an animation for its kind (`ActArt`), earlier steps list below, and what actually
 * ran is folded away under each step for anyone who wants it. Founder 2026-11-25: show it working,
 * don't read out commands.
 */
import { ActArt } from './ActArt.tsx';
import { groupSteps, narrate } from './activity.ts';

/** The feed shows the latest few; older ones fold into a count. */
const SHOWN = 6;

interface Props {
  activity: { tool: string; detail: string }[];
  working: boolean;
  keeperName: string;
  /** The turn's phase and the engine's name, shown as a pipeline while there are no tool steps. */
  phase?: string | null;
  mind?: string;
}

/** The turn's stages, in order (recalling from the DKG → thinking → showing → remembering). */
const STAGES: { phase: string; words: (mind: string) => string }[] = [
  { phase: 'recalling', words: () => 'Recalling from your DKG' },
  { phase: 'thinking', words: (mind) => (mind ? `Thinking with ${mind}` : 'Thinking') },
  { phase: 'acting', words: () => 'Working on it' },
  { phase: 'remembering', words: () => 'Writing to memory' },
];

function Pipeline({ phase, mind }: { phase: string; mind: string }) {
  const at = Math.max(0, STAGES.findIndex((s) => s.phase === phase));
  return (
    <ol className="pipeline">
      {STAGES.map((s, i) => (
        <li key={s.phase} className={i < at ? 'is-done' : i === at ? 'is-now' : ''}>
          <span className="pipe-dot" aria-hidden="true" />
          {s.words(mind)}
        </li>
      ))}
    </ol>
  );
}

export function ActivityPanel({ activity, working, keeperName, phase, mind = '' }: Props) {
  // Neighbouring steps that say the same thing are one line ("× 3"), so the list reads as a story.
  const groups = groupSteps(activity);
  const start = Math.max(0, groups.length - SHOWN);
  const shown = groups.slice(start);
  return (
    <section className={working ? 'activity glass is-working' : 'activity glass'} aria-label="What the keeper is doing">
      <header className="activity-head">
        {working ? <span className="spinner" aria-hidden="true" /> : <span className="dot ok" aria-hidden="true" />}
        <span className="activity-title">{working ? `${keeperName} is working` : `${keeperName} finished`}</span>
        {activity.length > 0 && <span className="activity-count">{activity.length} {activity.length === 1 ? 'step' : 'steps'}</span>}
      </header>
      {working && activity.length === 0 && <Pipeline phase={phase ?? 'thinking'} mind={mind} />}
      {working && activity.length > 0 && (() => {
        const now = activity[activity.length - 1];
        const n = narrate(now.tool, now.detail);
        return (
          <div className="act-now" key={activity.length}>
            <ActArt kind={n.kind} />
            <span className="act-now-words">{n.words}…</span>
          </div>
        );
      })()}
      {start > 0 && <p className="activity-earlier">+ {start} earlier</p>}
      <ol className="activity-list">
        {shown.map((n, i) => {
          const latest = working && i === shown.length - 1;
          return (
            <li key={start + i} className={latest ? 'act is-latest' : 'act'}>
              <span className="act-icon"><ActArt kind={n.kind} size={22} /></span>
              <span className="act-verb">{n.words}{n.times > 1 && <span className="muted small"> × {n.times}</span>}</span>
              {n.step.detail && (
                <details className="act-raw">
                  <summary>what ran</summary>
                  <code>{n.step.detail}</code>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
