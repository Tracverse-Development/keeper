/**
 * A small animated picture for each kind of work a keeper does on the computer: a folder opening,
 * a magnifier sweeping, a page being read or written, a file sliding to another folder, a sparkle
 * for something new, a file dropping into the bin, a window opening, apps pulsing, a bar filling, a
 * globe turning, a gear. Pure SVG + CSS (`panels-work.css`, `.art-*`); still when motion is reduced.
 */
import type { ActKind } from './activity.ts';

const FOLDER = 'M6 16h16l4 5h28a3 3 0 0 1 3 3v26a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3Z';

export function ActArt({ kind, size = 72 }: { kind: ActKind; size?: number }) {
  return (
    <svg className={`art art-${kind}`} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      {kind === 'folder' && (
        <g>
          <path className="art-paper" d="M14 22h30v20H14z" />
          <path className="art-back" d={FOLDER} />
          <path className="art-lid" d="M3 28h58l-4 22H7Z" />
        </g>
      )}
      {kind === 'search' && (
        <g>
          <path className="art-line" d="M8 18h36M8 28h28M8 38h34M8 48h22" />
          <g className="art-glass">
            <circle cx="40" cy="34" r="10" />
            <path d="M47 41l9 9" />
          </g>
        </g>
      )}
      {(kind === 'read' || kind === 'write') && (
        <g>
          <path className="art-page" d="M14 6h28l10 10v42H14Z" />
          <path className="art-text" d="M20 22h24M20 30h24M20 38h24M20 46h16" />
          {kind === 'read' && <rect className="art-highlight" x="18" y="18" width="28" height="8" rx="2" />}
          {kind === 'write' && <path className="art-pen" d="M44 50l12-12 4 4-12 12-6 2Z" />}
        </g>
      )}
      {kind === 'move' && (
        <g>
          <path className="art-back" d="M2 34h18l3 4h10v18H2Z" />
          <path className="art-back" d="M34 34h18l3 4h7v18H34Z" />
          <rect className="art-file" x="8" y="14" width="14" height="18" rx="2" />
        </g>
      )}
      {kind === 'create' && (
        <g>
          <path className="art-back" d={FOLDER} />
          <path className="art-plus" d="M32 26v18M23 35h18" />
          <path className="art-spark" d="M50 8l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" />
        </g>
      )}
      {kind === 'remove' && (
        <g>
          <rect className="art-file" x="25" y="4" width="14" height="18" rx="2" />
          <path className="art-bin" d="M16 30h32l-3 28H19Z" />
          <path className="art-bin-lid" d="M12 26h40" />
        </g>
      )}
      {kind === 'open' && (
        <g>
          <rect className="art-window" x="8" y="12" width="48" height="40" rx="5" />
          <path className="art-bar" d="M8 22h48" />
        </g>
      )}
      {kind === 'process' && (
        <g>
          {[0, 1, 2].map((i) => (
            <rect key={i} className={`art-app art-app-${i}`} x={6 + i * 19} y="22" width="15" height="15" rx="4" />
          ))}
        </g>
      )}
      {kind === 'measure' && (
        <g>
          <rect className="art-track" x="8" y="26" width="48" height="12" rx="6" />
          <rect className="art-fill" x="8" y="26" width="48" height="12" rx="6" />
        </g>
      )}
      {kind === 'web' && (
        <g className="art-globe">
          <circle cx="32" cy="32" r="22" />
          <ellipse className="art-meridian" cx="32" cy="32" rx="10" ry="22" />
          <path d="M10 32h44M14 20h36M14 44h36" />
        </g>
      )}
      {kind === 'work' && (
        <g className="art-gear">
          <circle cx="32" cy="32" r="9" />
          <path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6" />
        </g>
      )}
    </svg>
  );
}
