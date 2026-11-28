/**
 * A draft panel: the keeper's change to one text file, beside the old text, before anything is
 * saved. The file's name and folder, what changed and why, then the lines: taken-out lines struck
 * through, put-in lines marked, the words that changed inside an edited line highlighted, and
 * long unchanged stretches folded. Changed lines arrive one after another so the person watches
 * the edit happen (still under reduced motion).
 *
 * Save writes the file (the core refuses when the file changed meanwhile) and turns the panel
 * into the file's card (Open, Show in Finder). "Change something" puts "About <file>: " in the
 * talk box: what the person says next updates this same draft. "Edit the text" lets them change
 * the words themselves. "Throw away" forgets the draft; the file is untouched.
 */
import { useEffect, useState, type CSSProperties } from 'react';

import { fileSaved } from '../../files';
import { core, sentence } from '../../kernel/ipc';
import type { DraftLine, DraftSaved, DraftView } from '../../kernel/ipc-drafts.ts';
import { changeOpening, changeWords, readDraftView, revealOrder, stepMs } from '../draft-view.ts';
import { Icon } from '../icons.tsx';
import { FilePanel } from './FilePanel.tsx';
import type { ActingPanelProps } from './panel-props.ts';

type Ended = { saved: DraftSaved } | { thrownAway: true };

/** The core's draft, or a plain error when it came back in another shape. */
function checked(raw: unknown): DraftView {
  const view = readDraftView(raw);
  if (!view) throw new Error("I couldn't read that draft.");
  return view;
}

export function DraftPanel({ panel, onPick, onAction }: ActingPanelProps<'draft'>) {
  const [view, setView] = useState<DraftView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState<Ended | null>(null);

  useEffect(() => {
    let live = true;
    core.draftView(panel.draft)
      .then((raw) => { if (live) setView(checked(raw)); })
      .catch((e) => { if (live) setError(sentence(e)); });
    return () => { live = false; };
  }, [panel.draft]);

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(sentence(e));
    } finally {
      setBusy(false);
    }
  };

  const save = () => run(async () => {
    if (editing !== null) setView(checked(await core.draftEdit(panel.draft, editing)));
    const saved = await core.draftSave(panel.draft);
    setEnded({ saved });
    fileSaved(saved.path);
  });
  const doneEditing = () => run(async () => {
    if (editing === null) return;
    setView(checked(await core.draftEdit(panel.draft, editing)));
    setEditing(null);
  });
  const throwAway = () => run(async () => {
    await core.draftDiscard(panel.draft);
    setEnded({ thrownAway: true });
  });

  if (ended && 'saved' in ended) {
    const { saved } = ended;
    return (
      <div className="draft is-saved">
        <p className="draft-result" role="status"><Icon name="check" size={16} /> Saved {saved.name}.{panel.why ? ` ${panel.why[0].toUpperCase()}${panel.why.slice(1)}.` : ''}</p>
        <FilePanel panel={{ kind: 'file', id: `${panel.id}-saved`, title: saved.name, path: saved.path }} onPick={onPick} />
      </div>
    );
  }
  if (ended) return <p className="draft-result is-gone" role="status"><Icon name="cross" size={16} /> Thrown away. {panel.name} is just as it was.</p>;
  if (!view) return error ? <p className="error-line small">{error}</p> : <p className="muted small">Opening the draft…</p>;

  return (
    <div className="draft">
      <div className="draft-file">
        <Icon name="file" size={18} />
        <span className="draft-file-words">
          <strong className="file-name">{view.name}</strong>
          <span className="muted small">{view.folder}</span>
        </span>
        <span className={view.changed ? 'draft-count is-changed' : 'draft-count'}>{changeWords(view)}</span>
      </div>
      {view.why && <p className="draft-why"><Icon name="edit" size={14} /> {view.why}</p>}
      {editing === null ? (
        <DraftLines lines={view.lines} />
      ) : (
        <textarea className="field draft-editor selectable" value={editing} onChange={(e) => setEditing(e.target.value)} spellCheck autoFocus aria-label={`The new text of ${view.name}`} />
      )}
      <div className="draft-actions">
        <button type="button" className="btn btn-small btn-ghost draft-throw" disabled={busy} onClick={() => void throwAway()}>Throw away</button>
        <button type="button" className="btn btn-small" disabled={busy} onClick={() => onAction({ type: 'compose', text: changeOpening(view.name) })}>Change something</button>
        {editing === null
          ? <button type="button" className="btn btn-small" disabled={busy} onClick={() => setEditing(view.text)}><Icon name="edit" size={14} /> Edit the text</button>
          : <button type="button" className="btn btn-small" disabled={busy} onClick={() => void doneEditing()}>Done editing</button>}
        <button type="button" className="btn btn-primary btn-small draft-save" disabled={busy || (!view.changed && editing === null)} onClick={() => void save()}>
          <Icon name="check" size={14} /> Save
        </button>
      </div>
      {error && <p className="error-line small" role="alert">{error}</p>}
    </div>
  );
}

/** The before/after lines; changed ones arrive in order (`--d` is each one's delay). */
function DraftLines({ lines }: { lines: DraftLine[] }) {
  const order = revealOrder(lines);
  const step = stepMs(order.filter((n) => n >= 0).length);
  return (
    <ol className="draft-lines selectable">
      {lines.map((line, i) => {
        if (line.kind === 'gap') {
          return <li key={i} className="draft-gap">{line.skipped} unchanged {line.skipped === 1 ? 'line' : 'lines'}</li>;
        }
        const style = order[i] >= 0 ? ({ '--d': `${order[i] * step}ms` } as CSSProperties) : undefined;
        const mark = line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : '';
        return (
          <li key={i} className={`draft-line is-${line.kind}`} style={style}>
            <span className="draft-mark" aria-hidden>{mark}</span>
            <span className="draft-text">
              {line.kind !== 'same' && <span className="sr-only">{line.kind === 'added' ? 'Put in: ' : 'Taken out: '}</span>}
              {line.parts?.length
                ? line.parts.map((p, k) => (p.changed ? <span key={k} className="draft-word">{p.text}</span> : <span key={k}>{p.text}</span>))
                : line.text || ' '}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
