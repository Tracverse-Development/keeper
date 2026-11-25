/**
 * A path drawn as chips: folder › folder › file, the last piece brightest. Shared by the files
 * panel and the activity feed; the full path stays in the tooltip.
 */
import { breadcrumbs } from './activity.ts';

export function Breadcrumbs({ path, max = 4 }: { path: string; max?: number }) {
  const pieces = breadcrumbs(path, max);
  return (
    <span className="crumbs" title={path}>
      {pieces.map((piece, i) => (
        <span key={i} className="crumb-wrap">
          {i > 0 && <span className="crumb-sep" aria-hidden="true">›</span>}
          <span className={i === pieces.length - 1 ? 'crumb is-leaf' : 'crumb'}>{piece}</span>
        </span>
      ))}
    </span>
  );
}
