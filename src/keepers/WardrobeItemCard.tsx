/**
 * One item in the wardrobe grid: its colours, name and who wears it. Picking it tries it on in
 * the preview; once picked it shows what you can do: wear it or take it off, and give it to
 * another keeper (move it, or share it when it is a design rather than one of a kind).
 */
import { useState } from 'react';

import type { CSSProperties } from 'react';

import type { GiveMode, Rarity, WardrobeKeeper } from '../kernel/ipc';
import { wornLine, type ItemView } from './wardrobe-view';

interface Props {
  view: ItemView;
  keeperName: string;
  colours: string[];
  picked: boolean;
  /** The keeper's body offers this slot. */
  wearable: boolean;
  busy: boolean;
  targets: WardrobeKeeper[];
  onPick: () => void;
  onWear: () => void;
  onTakeOff: () => void;
  onGive: (to: string, mode: GiveMode) => void;
  /** In the Studio: the item's rarity (its frame) and the level it still needs (null = may wear). */
  rarity?: Rarity;
  lockedUntil?: number | null;
}

export function WardrobeItemCard({ view, keeperName, colours, picked, wearable, busy, targets, onPick, onWear, onTakeOff, onGive, rarity, lockedUntil }: Props) {
  const { item, wornHere } = view;
  const [to, setTo] = useState(targets[0]?.id ?? '');
  const worn = wornLine(view, keeperName);
  const locked = lockedUntil != null && !wornHere;
  const frame = rarity ? ({ '--rarity': rarity.color } as CSSProperties) : undefined;
  return (
    <div className={`wardrobe-item ${picked ? 'is-picked' : ''} ${wornHere ? 'is-worn' : ''} ${rarity ? `has-rarity rarity-${rarity.id}` : ''} ${locked ? 'is-locked' : ''}`} style={frame}>
      <button type="button" className="wardrobe-pick" aria-pressed={picked} onClick={onPick}>
        <span className="wardrobe-swatches" aria-hidden="true">
          {colours.map((c, i) => (
            <span key={i} className="wardrobe-swatch" style={{ background: c }} />
          ))}
        </span>
        <strong>{item.name}</strong>
        <span className="wardrobe-tags">
          {item.oneOfAKind && <span className="wardrobe-tag">One of a kind</span>}
          {item.source === 'yours' && <span className="wardrobe-tag">Yours</span>}
          {rarity && <span className="wardrobe-tag wardrobe-rarity">{rarity.name}</span>}
          {locked && <span className="wardrobe-tag wardrobe-lock">Level {lockedUntil}</span>}
        </span>
        <span className="muted small">{worn || (wearable ? 'In the wardrobe' : 'Not for this body')}</span>
      </button>
      {picked && (
        <div className="wardrobe-actions">
          {wornHere ? (
            <button type="button" className="btn btn-small" disabled={busy} onClick={onTakeOff}>
              Take off
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-small" disabled={busy || !wearable || locked} title={locked ? `Unlocks at level ${lockedUntil}` : undefined} onClick={onWear}>
              {locked ? `Unlocks at level ${lockedUntil}` : `Wear${item.oneOfAKind && view.others.length > 0 ? ` (from ${view.others[0]})` : ''}`}
            </button>
          )}
          {wornHere && targets.length > 0 && (
            <div className="wardrobe-give">
              <select className="field" aria-label="Give to" value={to} onChange={(e) => setTo(e.target.value)}>
                {targets.map((k) => (
                  <option key={k.id} value={k.id}>
                    Give to {k.name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-small" disabled={busy || !to} onClick={() => onGive(to, 'move')}>
                Move
              </button>
              <button type="button" className="btn btn-ghost btn-small" disabled={busy || !to || item.oneOfAKind} title={item.oneOfAKind ? 'One of a kind: only one keeper can wear it' : undefined} onClick={() => onGive(to, 'share')}>
                Share
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
