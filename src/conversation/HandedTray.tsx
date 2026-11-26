/**
 * The card above the message box for what the person handed over: its name, how much of it
 * will be read, three ready-made requests, and a way to put it down. Typing a message while it
 * is held sends that message about it instead.
 */
import { HANDED_ASKS, handedSize } from './handed';
import type { Held } from './useHanded';

interface Props {
  held: Held | null;
  error: string | null;
  busy: boolean;
  keeperName: string;
  onAsk: (say: string) => void;
  onClear: () => void;
}

export function HandedTray({ held, error, busy, keeperName, onAsk, onClear }: Props) {
  if (!held && !error) return null;
  return (
    <div className="handed glass" role="group" aria-label="What you handed over">
      <div className="handed-head">
        <span className="handed-mark" aria-hidden>
          ▤
        </span>
        <div className="handed-what">
          {held ? (
            <>
              <strong className="selectable">{held.peek.name}</strong>
              <span className="muted small">
                {handedSize(held.peek.chars, held.peek.truncated)}
                {held.more > 0 ? ` One at a time: ${held.more} more left out.` : ''}
              </span>
            </>
          ) : (
            <span className="error-line">{error}</span>
          )}
        </div>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onClear} aria-label="Put it down">
          ✕
        </button>
      </div>
      {held && (
        <div className="handed-asks">
          {HANDED_ASKS.map((a) => (
            <button key={a.id} type="button" className="btn btn-small" disabled={busy} onClick={() => onAsk(a.say)}>
              {a.label}
            </button>
          ))}
          <span className="muted small">or type what you want {keeperName} to do with it</span>
        </div>
      )}
    </div>
  );
}
