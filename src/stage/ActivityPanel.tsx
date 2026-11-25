/**
 * The agent's live tool calls as a friendly feed: an icon and a plain verb per tool ("Reading",
 * "Running a command"), the detail as a chip (paths as breadcrumbs, web addresses as their host),
 * new items sliding in and a shimmer on the newest while the keeper is still working.
 */
import { detailKind, toolLook, urlHost } from './activity.ts';
import { Breadcrumbs } from './Breadcrumbs.tsx';
import { Icon } from './icons.tsx';

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

function Detail({ detail }: { detail: string }) {
  const kind = detailKind(detail);
  if (kind === 'path') return <Breadcrumbs path={detail} max={4} />;
  if (kind === 'url') return <span className="act-chip" title={detail}>{urlHost(detail)}</span>;
  return detail ? <span className="act-chip mono" title={detail}>{detail}</span> : null;
}

export function ActivityPanel({ activity, working, keeperName, phase, mind = '' }: Props) {
  const start = Math.max(0, activity.length - SHOWN);
  const shown = activity.slice(start);
  return (
    <section className={working ? 'activity glass is-working' : 'activity glass'} aria-label="What the keeper is doing">
      <header className="activity-head">
        {working ? <span className="spinner" aria-hidden="true" /> : <span className="dot ok" aria-hidden="true" />}
        <span className="activity-title">{working ? `${keeperName} is working` : `${keeperName} finished`}</span>
        {activity.length > 0 && <span className="activity-count">{activity.length} {activity.length === 1 ? 'step' : 'steps'}</span>}
      </header>
      {working && activity.length === 0 && <Pipeline phase={phase ?? 'thinking'} mind={mind} />}
      {start > 0 && <p className="activity-earlier">+ {start} earlier</p>}
      <ol className="activity-list">
        {shown.map((item, i) => {
          const look = toolLook(item.tool);
          const latest = working && i === shown.length - 1;
          return (
            <li key={start + i} className={latest ? 'act is-latest' : 'act'}>
              <span className={`act-icon is-${look.icon}`}><Icon name={look.icon} size={16} /></span>
              <span className="act-verb">{look.verb}</span>
              <span className="act-detail"><Detail detail={item.detail} /></span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
