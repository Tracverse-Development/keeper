/**
 * A row of colour swatches for one item (its own colours first, then its palette: `colour-choice.ts`).
 * A radio group: Tab reaches the chosen swatch, the arrow keys (and Home, End) move to another and
 * choose it, a click chooses; pointing at a swatch tries that colour on without choosing it.
 * Renders nothing for an item with no palette.
 *
 * Usage: `<ColourSwatches label="Ember Jacket" swatches={swatchesOf(item)} chosen={id}
 * onPick={(id) => …} onPreview={(id) => …} />` (`id` '' is its own colours; preview null = stop).
 */
import { useRef, type CSSProperties, type KeyboardEvent } from 'react';

import { swatchMove, type Swatch } from './colour-choice';

interface Props {
  /** The item's name, for the group's label ("Colour of the Ember Jacket"). */
  label: string;
  swatches: Swatch[];
  /** The chosen swatch id ('' = its own colours). */
  chosen: string;
  onPick: (id: string) => void;
  /** Try a colour on while pointing at it (null: back to the chosen one). */
  onPreview?: (id: string | null) => void;
}

export function ColourSwatches({ label, swatches, chosen, onPick, onPreview }: Props) {
  const row = useRef<HTMLDivElement>(null);
  if (!swatches.length) return null;
  const at = Math.max(0, swatches.findIndex((s) => s.id === chosen));
  const key = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = swatchMove(index, e.key, swatches.length);
    if (next === null) return;
    e.preventDefault();
    (row.current?.querySelectorAll('button')[next] as HTMLButtonElement | undefined)?.focus();
    onPick(swatches[next].id);
  };
  return (
    <div ref={row} className="item-colours" role="radiogroup" aria-label={`Colour of the ${label}`}>
      {swatches.map((s, i) => (
        <button
          key={s.id || 'own'}
          type="button"
          role="radio"
          aria-checked={i === at}
          aria-label={s.name}
          title={s.name}
          tabIndex={i === at ? 0 : -1}
          className={`item-colour ${i === at ? 'is-on' : ''} ${s.id ? '' : 'is-own'}`}
          style={{ '--fill': s.fill, '--edge': s.edge ?? s.fill } as CSSProperties}
          onClick={() => onPick(s.id)}
          onKeyDown={(e) => key(e, i)}
          onMouseEnter={() => onPreview?.(s.id)}
          onMouseLeave={() => onPreview?.(null)}
        />
      ))}
    </div>
  );
}
