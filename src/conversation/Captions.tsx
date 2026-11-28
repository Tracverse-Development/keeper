/**
 * Captions: the latest exchange under the keeper, like subtitles, so the character is never
 * covered. What the person said on one small line, then the keeper's words with no card behind
 * them: the newest words while the reply arrives (`liveTail`), then its first page (`captionPage`).
 * A short line of what else happened (remembered, steps taken) and "Read all" open the Transcript,
 * where every card of the conversation lives (`TranscriptRail`).
 */
import { CAPTION_CHARS, captionPage, liveTail } from './caption-page.ts';
import type { Exchange } from './useAssistant';

interface Props {
  exchange: Exchange | undefined;
  assistantName: string;
  /** Opens the Transcript (the whole conversation, every card). */
  onReadAll: () => void;
}

export function Captions({ exchange: x, assistantName, onReadAll }: Props) {
  if (!x) return null;
  const reply = x.result?.reply ?? '';
  const page = reply ? captionPage(reply, CAPTION_CHARS) : null;
  const extras = x.result ? extrasWords(x) : '';
  return (
    <div className="captions" aria-live="polite">
      {x.said && <p className="caption-you selectable">{x.said}</p>}
      {x.error ? (
        <p className="caption-line error-line">{x.error}</p>
      ) : page ? (
        <p className="caption-line selectable" aria-label={`${assistantName} said: ${reply}`}>
          {page.shown}
        </p>
      ) : x.live ? (
        <p className="caption-line is-live selectable">
          {liveTail(x.live)}
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
