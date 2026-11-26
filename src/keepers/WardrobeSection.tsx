/**
 * The Wardrobe: everything the person owns, by slot, for the keeper being set up. A live preview
 * shows the keeper as dressed, or trying on the picked item; slot tabs say which slots its body
 * offers (a body without a slot says so instead of failing); each item can be worn or taken off,
 * and given to another keeper. Wearing is decided by the core (`kit/wardrobe.rs`), which saves
 * the keeper's outfit; the stage behind the sheet is redressed through `onChanged`.
 */
import { useEffect, useMemo, useState } from 'react';

import { CharacterStage, PARTS } from '../character';
import type { KeeperProfile, StudioInfo } from '../kernel/ipc';
import { lockedUntil, rarityOf } from '../studio/studio-view';
import { useWardrobe } from './useWardrobe';
import { WardrobeItemCard } from './WardrobeItemCard';
import { WardrobeMaker } from './WardrobeMaker';
import { giveTargets, missingSlotLine, slotGroups, swatches, tryOn } from './wardrobe-view';
import './wardrobe.css';

interface Props {
  open: boolean;
  keeper: KeeperProfile;
  /** An outfit changed: reload the keepers (the stage redresses). */
  onChanged: () => void;
  /** In the Studio: rarity frames and level locks on every item. */
  studio?: StudioInfo;
  /** In the Studio: the outfit to show on its big stage (this section then draws no preview). */
  onPreview?: (wearables: KeeperProfile['wearables'], caption: string) => void;
}

const DEFAULTS: Record<string, Record<string, number | string>> = Object.fromEntries(
  PARTS.map((p) => [p.id, Object.fromEntries(Object.entries(p.effects).map(([key, spec]) => [key, spec.default]))]),
);

export function WardrobeSection({ open, keeper, onChanged, studio, onPreview }: Props) {
  const { wardrobe, error, busy, wear, takeOff, give, add } = useWardrobe(open, onChanged);
  const [slotId, setSlotId] = useState('torso');
  const [picked, setPicked] = useState<string | null>(null);
  const groups = useMemo(() => (wardrobe ? slotGroups(wardrobe, keeper.id) : []), [wardrobe, keeper.id]);
  const group = groups.find((g) => g.slot.id === slotId) ?? groups[0];
  const pickedView = group?.items.find((v) => v.item.id === picked) ?? null;
  const trying = pickedView && !pickedView.wornHere && group?.offered ? pickedView.item : null;
  const preview = wardrobe ? tryOn(keeper.wearables, trying, wardrobe) : keeper.wearables;
  const body = wardrobe?.keepers.find((k) => k.id === keeper.id);
  const caption = trying ? `Trying on the ${trying.name}` : `${keeper.name}, as dressed`;
  const previewKey = JSON.stringify(preview);
  useEffect(() => {
    onPreview?.(preview, caption);
  }, [previewKey, caption]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="wardrobe">
      <div className={`wardrobe-top ${onPreview ? 'is-wide' : ''}`}>
        {!onPreview && (
          <div className="wardrobe-preview">
            {open && <CharacterStage className="wardrobe-stage" skin={keeper.skin} wearables={preview} mood="idle" voiceLevel={0} mouth={0} memoryPulse={0} />}
            <span className="wardrobe-caption">{caption}</span>
          </div>
        )}
        <div className="wardrobe-side">
          <div className="wardrobe-slots" role="tablist" aria-label="Slots">
            {groups.map((g) => (
              <button key={g.slot.id} type="button" role="tab" aria-selected={g.slot.id === group?.slot.id} className={`wardrobe-slot ${g.slot.id === group?.slot.id ? 'is-on' : ''} ${g.offered ? '' : 'is-missing'}`} onClick={() => { setSlotId(g.slot.id); setPicked(null); }}>
                {g.slot.name}
                {g.items.some((v) => v.wornHere) && <span className="dot ok" aria-label="wearing something here" />}
              </button>
            ))}
          </div>
          <p className="muted small">
            Items are designs: any keeper can wear them, on any body with that slot. One of a kind items are worn by one keeper at a time.
          </p>
          {wardrobe && !wardrobe.complete && <p className="warn-text small">Your memory node isn't answering, so only the built-in items are shown.</p>}
        </div>
      </div>
      {error && <p className="error-line">{error}</p>}
      {group && !group.offered && <p className="wardrobe-missing">{missingSlotLine(body, group.slot)}</p>}
      <div className="wardrobe-grid">
        {group?.items.map((view) => (
          <WardrobeItemCard
            key={view.item.id}
            view={view}
            keeperName={keeper.name}
            colours={swatches(view.item, DEFAULTS[view.item.part] ?? {})}
            picked={picked === view.item.id}
            wearable={group.offered}
            busy={busy}
            targets={wardrobe ? giveTargets(wardrobe, keeper.id) : []}
            onPick={() => setPicked(picked === view.item.id ? null : view.item.id)}
            onWear={() => void wear(keeper.id, view.item.id)}
            onTakeOff={() => void takeOff(keeper.id, view.item.id)}
            onGive={(to, mode) => void give(view.item.id, keeper.id, to, mode)}
            rarity={studio ? rarityOf(studio, view.item.part) : undefined}
            lockedUntil={studio ? lockedUntil(rarityOf(studio, view.item.part), studio.experience.level) : null}
          />
        ))}
      </div>
      <WardrobeMaker key={group?.slot.id} slot={group?.slot.id ?? 'torso'} busy={busy} onSave={add} />
    </div>
  );
}
