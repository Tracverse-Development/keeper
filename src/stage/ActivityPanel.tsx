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
}

function Detail({ detail }: { detail: string }) {
  const kind = detailKind(detail);
  if (kind === 'path') return <Breadcrumbs path={detail} max={4} />;
  if (kind === 'url') return <span className="act-chip" title={detail}>{urlHost(detail)}</span>;
  return detail ? <span className="act-chip mono" title={detail}>{detail}</span> : null;
}

export function ActivityPanel({ activity, working, keeperName }: Props) {
  const start = Math.max(0, activity.length - SHOWN);
  const shown = activity.slice(start);
  return (
    <section className={working ? 'activity glass is-working' : 'activity glass'} aria-label="What the keeper is doing">
      <header className="activity-head">
        {working ? <span className="spinner" aria-hidden="true" /> : <span className="dot ok" aria-hidden="true" />}
        <span className="activity-title">{working ? `${keeperName} is working` : `${keeperName} finished`}</span>
        <span className="activity-count">{activity.length} {activity.length === 1 ? 'step' : 'steps'}</span>
      </header>
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
