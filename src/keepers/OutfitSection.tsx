/**
 * What the keeper wears, slot by slot (halo, base, aura): any built-in part or saved variant that
 * fits its body, or nothing. The choices come from the Kit catalog (the core validates the outfit;
 * the character draws it).
 */
import type { KitCatalog, WornPart } from '../kernel/ipc';
import { outfitChoices, wear } from './outfit';

interface Props {
  kit: KitCatalog;
  species: string;
  wearables: WornPart[];
  onChange: (wearables: WornPart[]) => void;
}

export function OutfitSection({ kit, species, wearables, onChange }: Props) {
  const slots = kit.species.find((s) => s.id === species)?.slots ?? [];
  return (
    <div className="outfit">
      {slots.map((slot) => {
        const choices = outfitChoices(kit, species, slot);
        const worn = wearables.find((w) => kit.parts.find((p) => p.id === w.part)?.slot === slot);
        const current = choices.find((c) => c.worn.part === worn?.part && JSON.stringify(c.worn.effects ?? {}) === JSON.stringify(worn?.effects ?? {}));
        return (
          <label key={slot} className="outfit-slot">
            <span className="label">{slot[0].toUpperCase() + slot.slice(1)}</span>
            <select className="field" value={current?.key ?? (worn ? 'custom' : '')} onChange={(e) => onChange(wear(wearables, kit, slot, choices.find((c) => c.key === e.target.value)?.worn ?? null))}>
              <option value="">Nothing</option>
              {worn && !current && <option value="custom">Custom ({worn.part})</option>}
              {choices.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
