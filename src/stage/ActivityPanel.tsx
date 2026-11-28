/**
 * What the keeper is doing on the computer, live, in words a person would say ("Looking in
 * Applications", "Moving report.pdf to Documents"), never as commands: the step being done now
 * plays large with an animation for its kind (`ActArt`), earlier steps list below, and what actually
 * ran is folded away under each step for anyone who wants it. Founder 2026-11-25: show it working,
 * don't read out commands. With `control` (founder 2026-11-27: "pause a keeper mid work and have
 * it fix things") the card also shows how long it has worked and the Pause / Resume, Change
 * course and Stop controls (`WorkControls`); paused, its motion stops and it says so.
 */
import type { WorkControl } from '../conversation/useWorkControl.ts';
import { elapsedWords } from '../conversation/work-control.ts';
import { ActArt } from './ActArt.tsx';
import { groupSteps, isCourseChange, narrate, stepMeta } from './activity.ts';
import { PauseIcon, WorkControls } from './WorkControls.tsx';

/** The feed shows the latest few; older ones fold into a count. */
const SHOWN = 6;

interface Props {
  activity: { tool: string; detail: string }[];
  working: boolean;
  keeperName: string;
  /** The turn's phase and the engine's name, shown as a pipeline while there are no tool steps. */
  phase?: string | null;
  mind?: string;
  /** Pause / Resume, Change course, Stop and the work clock (absent: the card only watches). */
  control?: WorkControl;
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

export function ActivityPanel({ activity, working, keeperName, phase, mind = '', control }: Props) {
  const paused = working && Boolean(control?.paused);
  const steps = activity.filter((s) => !isCourseChange(s)).length;
  // Neighbouring steps that say the same thing are one line ("× 3"), so the list reads as a story.
  const groups = groupSteps(activity);
  const start = Math.max(0, groups.length - SHOWN);
  const shown = groups.slice(start);
  return (
    <section className={`activity glass ${working ? 'is-working' : ''} ${paused ? 'is-paused' : ''}`} aria-label="What the keeper is doing">
      <header className="activity-head">
        {paused ? <span className="paused-mark" aria-hidden="true"><PauseIcon size={10} /></span> : working ? <span className="spinner" aria-hidden="true" /> : <span className="dot ok" aria-hidden="true" />}
        <span className="activity-title" aria-live="polite">{paused ? `${keeperName} is paused` : working ? `${keeperName} is working` : `${keeperName} finished`}</span>
        <span className="activity-count">
          {steps > 0 && `${steps} ${steps === 1 ? 'step' : 'steps'}`}
          {working && control && <span className="work-clock" title="Time worked (pauses not counted)">{elapsedWords(control.workedMs)}</span>}
        </span>
      </header>
      {working && activity.length === 0 && <Pipeline phase={phase ?? 'thinking'} mind={mind} />}
      {working && activity.length > 0 && (() => {
        const now = activity[activity.length - 1];
        // Just after a correction, the keeper is starting again with it.
        const n = isCourseChange(now) ? { words: 'Starting again with your change', kind: 'work' as const } : narrate(now.tool, now.detail);
        return (
          <div className="act-now" key={activity.length}>
            <ActArt kind={n.kind} />
            <span className="act-now-words">{paused ? `Paused while ${n.words.charAt(0).toLowerCase()}${n.words.slice(1)}` : `${n.words}…`}</span>
          </div>
        );
      })()}
      {start > 0 && <p className="activity-earlier">+ {start} earlier</p>}
      <ol className="activity-list">
        {shown.map((n, i) => {
          const latest = working && i === shown.length - 1;
          if (isCourseChange(n.step)) {
            return (
              <li key={start + i} className="act-course">
                <span aria-hidden="true">↪</span> {n.words}
              </li>
            );
          }
          return (
            <li key={start + i} className={latest ? 'act is-latest' : 'act'}>
              <span className="act-icon"><ActArt kind={n.kind} size={22} /></span>
              <span className="act-verb">
                {n.words}{n.times > 1 && <span className="muted small"> × {n.times}</span>}
                <span className="act-meta">{stepMeta(n.step.tool, n.step.detail)}</span>
              </span>
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
      {working && control && <WorkControls control={control} keeperName={keeperName} />}
    </section>
  );
}
