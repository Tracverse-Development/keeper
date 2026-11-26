/**
 * One wardrobe item as a card, the same in the Marketplace and the Inventory: a picture made
 * from the item's own colours, framed in its rarity, with its name, tags, one line and actions.
 * Pointing at (or tabbing to) a card tries the item on the Studio's big stage.
 */
import type { CSSProperties, ReactNode } from 'react';

import type { Rarity } from '../kernel/ipc-studio';

interface Props {
  name: string;
  rarity: Rarity;
  slotName: string;
  colours: string[];
  /** The level it still needs (the picture is greyed and says so), or null. */
  locked: number | null;
  worn?: boolean;
  /** Extra small labels after the rarity and the slot ("Forged"). */
  tags?: string[];
  /** One line under the name. */
  line?: string;
  /** The card's buttons. */
  children: ReactNode;
  onTry: (on: boolean) => void;
}

export function ItemCard({ name, rarity, slotName, colours, locked, worn = false, tags = [], line, children, onTry }: Props) {
  const paint = { '--rarity': rarity.color, '--art-a': colours[0] ?? 'var(--navy-500)', '--art-b': colours[1] ?? colours[0] ?? 'var(--gold-600)' } as CSSProperties;
  return (
    <article className={`item-card rarity-${rarity.id} ${worn ? 'is-worn' : ''} ${locked !== null ? 'is-locked' : ''}`} style={paint} onMouseEnter={() => onTry(true)} onMouseLeave={() => onTry(false)} onFocus={() => onTry(true)} onBlur={() => onTry(false)}>
      <div className="item-art" aria-hidden="true">
        <span className="item-art-shine" />
        {locked !== null && <span className="item-lock">Level {locked}</span>}
        {worn && <span className="item-worn">Wearing</span>}
      </div>
      <div className="item-body">
        <strong className="item-name">{name}</strong>
        <span className="item-tags">
          <span className="tag tag-rarity">{rarity.name}</span>
          <span className="tag">{slotName}</span>
          {tags.map((t) => <span key={t} className="tag">{t}</span>)}
        </span>
        {line && <span className="item-line muted">{line}</span>}
        <span className="item-actions">{children}</span>
      </div>
    </article>
  );
}
