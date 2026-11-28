/**
 * Captions: the latest exchange under the keeper, like subtitles, so the character is never
 * covered. What the person said on one small line, then the keeper's words with no card behind
 * them: the newest words while the reply arrives (`liveTail`), then its first page (`captionPage`).
 * A short line of what else happened (remembered, steps taken) and "Read all" open the Transcript,
 * where every card of the conversation lives (`TranscriptRail`). A while after a reply has
 * finished (`RESTING_AFTER_MS`) the captions dim, so the keeper has the screen to itself between
 * conversations; pointing at them brings them back, and the next exchange shows in full.
 */
import { useEffect, useState } from 'react';

import { CAPTION_CHARS, captionPage, liveTail, NARROW_CAPTION_CHARS } from './caption-page.ts';
import type { Exchange } from './useAssistant';

/** How long a finished reply stays bright before the captions dim. */
export const RESTING_AFTER_MS = 40_000;

interface Props {
  exchange: Exchange | undefined;
  assistantName: string;
  /** Opens the Transcript (the whole conversation, every card). */
  onReadAll: () => void;
  /** The keeper's column is narrow (the Stage's panels are showing): shorter captions. */
  narrow?: boolean;
}

export function Captions({ exchange: x, assistantName, onReadAll, narrow = false }: Props) {
  const max = narrow ? NARROW_CAPTION_CHARS : CAPTION_CHARS;
  const finished = Boolean(x?.result || x?.error);
  const [resting, setResting] = useState(false);
  useEffect(() => {
    setResting(false);
    if (!finished) return;
    const timer = window.setTimeout(() => setResting(true), RESTING_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [x?.id, finished]);
  if (!x) return null;
  const reply = x.result?.reply ?? '';
  const page = reply ? captionPage(reply, max) : null;
  const extras = x.result ? extrasWords(x) : '';
  return (
    <div className={`captions ${resting ? 'is-resting' : ''}`} aria-live="polite">
      {x.said && <p className="caption-you selectable">{x.said}</p>}
      {x.error ? (
        <p className="caption-line error-line">{x.error}</p>
      ) : page ? (
        <p className="caption-line selectable" aria-label={`${assistantName} said: ${reply}`}>
          {page.shown}
        </p>
      ) : x.live ? (
        <p className="caption-line is-live selectable">
          {liveTail(x.live, max)}
          <span className="caret" aria-hidden />
        </p>
      ) : null}
      {x.result && (page?.more || extras) && (
        <button type="button" className="caption-more" onClick={onReadAll}>
          {[extras, page?.more ? 'Read all' : 'Details'].filter(Boolean).join(' · ')}
        </button>
      )}
    </div>
  );
}

/** What else the reply did, in a few words ("Remembered 1 · 2 steps"); "" when nothing. */
function extrasWords(x: Exchange): string {
  const r = x.result;
  if (!r) return '';
  const parts: string[] = [];
  if (r.learned.length) parts.push(`Remembered ${r.learned.length}`);
  if (r.forgotten.length) parts.push(`Forgot ${r.forgotten.length}`);
  if (r.steps.length) parts.push(r.steps.length === 1 ? '1 step' : `${r.steps.length} steps`);
  return parts.join(' · ');
}
