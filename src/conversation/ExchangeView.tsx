/**
 * One exchange as the Transcript shows it: what the person said (and any corrections), the
 * keeper's reply, what it remembered or forgot (with undo), the steps it took, the facts it used,
 * how fast it was and its memory trail. The cards the conversation always had, in one place.
 */
import { DkgTrail } from './DkgTrail';
import { KnownFacts } from './KnownFacts';
import { Receipt } from './Receipt';
import { forgottenWords } from './known-facts';
import { UndoFact } from './UndoFact';
import { waitingWords } from './undo-view';
import { speedWords } from './speed-words';
import type { Exchange } from './useAssistant';
import { correctionWords } from './work-control.ts';

interface Props {
  x: Exchange;
  busy: boolean;
  /** Says something for the person (a receipt's Undo). */
  onSend: (text: string) => void;
}

export function ExchangeView({ x, busy, onSend }: Props) {
  return (
    <div className="exchange">
      {x.said && (
        <p className={`bubble you selectable ${x.queued ? 'is-queued' : ''}`}>
          {x.said}
          {x.queued && <span className="queued-note">waiting its turn</span>}
        </p>
      )}
      {x.corrections?.map((c, i) => (
        <p key={i} className="bubble you correction selectable">
          {correctionWords(c)}
        </p>
      ))}
      {x.result && (
        <div className="bubble them">
          <p className="selectable">{x.result.reply}</p>
          {x.result.learned.length + x.result.forgotten.length > 0 && (
            <ul className="learned">
              {x.result.learned.map((f) => (
                <li key={f.id}>Remembered: {f.text}</li>
              ))}
              {x.result.forgotten.map((f) => (
                <li key={f.id}>
                  <span className="is-gone">{forgottenWords(x.result!.learned.length > 0)}: {f.text}</span>
                  <UndoFact fact={f} keeper={x.result!.keeper} leftAt={x.at ?? 0} />
                </li>
              ))}
            </ul>
          )}
          {waitingWords(x.result.writes.filter((w) => w.queued).length) && <p className="muted small">{waitingWords(x.result.writes.filter((w) => w.queued).length)}</p>}
          {x.note && <p className="bubble-note">✦ {x.note}</p>}
          {x.result.steps.length > 0 && <Receipt steps={x.result.steps} busy={busy} onUndo={onSend} />}
          {(x.result.used?.length ?? 0) > 0 && <KnownFacts facts={x.result.used ?? []} keeper={x.result.keeper} />}
          {x.result.timings && <p className="turn-speed muted small">{speedWords(x.result.timings)}</p>}
          {x.result.traces.length + x.result.writes.length > 0 && <DkgTrail result={x.result} />}
        </div>
      )}
      {!x.result && !x.error && x.live && (
        <div className="bubble them is-live">
          <p className="selectable">
            {x.live}
            <span className="caret" aria-hidden />
          </p>
        </div>
      )}
      {x.error && <p className="bubble them error-line">{x.error}</p>}
    </div>
  );
}
