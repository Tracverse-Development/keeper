/**
 * A small celebration for finishing something in a panel (a checklist done, a flashcard deck
 * through): a gold burst behind a short line of text. Drawn with CSS only; under reduced motion
 * the burst is hidden and only the words show.
 */
import { Icon } from '../icons.tsx';
import { stagger } from '../stagger.ts';

const PARTICLES = 14;

export function Celebration({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="celebrate" role="status">
      <span className="celebrate-burst" aria-hidden="true">
        {Array.from({ length: PARTICLES }, (_, i) => <i key={i} style={stagger(i)} />)}
      </span>
      <span className="celebrate-badge"><Icon name="sparkle" size={20} /></span>
      <span className="celebrate-words">
        <strong>{title}</strong>
        {detail && <span>{detail}</span>}
      </span>
    </div>
  );
}
