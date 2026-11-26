/**
 * Forge: make new mods. From words (the helper model picks the part and its colours, validated
 * like any import; the keeper wears it on the stage before you keep it), from a base part (choose
 * the part and set its colours yourself), and personal items with your own picture. Everything
 * forged lands in the Inventory. A forged mod takes its part's rarity: rarity is never forged.
 */
import { PARTS } from '../character';
import type { KeeperProfile, NewWardrobeItem, StudioInfo, WornPart } from '../kernel/ipc';
import { WardrobeMaker } from '../keepers/WardrobeMaker';
import { DesignBox, wearDesigned } from './DesignBox';
import { PersonalBox } from './PersonalBox';

interface Props {
  info: StudioInfo;
  keeper: KeeperProfile;
  busy: boolean;
  onPreview: (wearables: WornPart[] | null, caption: string) => void;
  onForged: () => void;
  onMake: (item: NewWardrobeItem) => Promise<boolean>;
}

const IDEAS = ['a neon pink jacket with gold trim', 'a cosy green scarf with cream stripes', 'a slow purple halo', 'a fiery aura that swirls fast'];

export function ForgeTab({ info, keeper, busy, onPreview, onForged, onMake }: Props) {
  return (
    <div className="studio-tab">
      <DesignBox wearables={keeper.wearables} onPreview={onPreview} onKept={onForged} ideas={IDEAS} />
      <div className="studio-design">
        <p className="eyebrow">Forge from a base</p>
        <p className="muted small">Choose a part and set its colours and motion yourself; your keeper tries it on as you go. {PARTS.length} parts to start from.</p>
        <WardrobeMaker
          slot="torso"
          busy={busy}
          onSave={onMake}
          onTry={(item) => (item ? onPreview(wearDesigned(keeper.wearables, { name: '', part: item.part, effects: item.effects ?? {} }), 'Trying on what you are making') : onPreview(null, ''))}
        />
      </div>
      <PersonalBox info={info} keeper={keeper.id} onChanged={() => onForged()} />
    </div>
  );
}
