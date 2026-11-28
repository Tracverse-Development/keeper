/**
 * Look: a ready-made FINISH for the whole body (Brushed Titanium, Golden Fleece…, opened by level
 * like an item of its rarity), the COAT switch on a body that can grow one (Smooth, the standard,
 * or the dog's fur / the owl's feathers), or pick a paint zone (the stage zooms to it), then its
 * colour and material. A coat is never unlocked by level: a keeper wears one only once it has
 * obtained it (the core checks too: `kit/look.rs` `OBTAINED_ONLY`), so a coat a keeper lacks shows
 * as "Obtained only". Changes are a draft until the Studio saves them.
 */
import type { StudioInfo, ZoneLook } from '../kernel/ipc-studio';
import { applyFinish, coatOn, finishLock, rarityOf, setCoat, setZone, SWATCHES } from './studio-view';

interface Props {
  info: StudioInfo;
  look: Record<string, ZoneLook>;
  zone: string | null;
  onZone: (zone: string | null) => void;
  onLook: (look: Record<string, ZoneLook>) => void;
}

export function LookTab({ info, look, zone, onZone, onLook }: Props) {
  const current = zone ? look[zone] ?? {} : {};
  const coat = info.coat ?? null;
  const obtained = info.obtained ?? [];
  const coated = coat !== null && coatOn(look, coat);
  const coatMaterial = coat ? info.materials.find((m) => m.id === coat.material) : undefined;
  const coatRarity = rarityOf(info, { part: '', rarity: coatMaterial?.rarity });
  const hasCoat = coat !== null && obtained.includes(coat.material);
  const coatName = coat?.material === 'feathers' ? 'Feathered' : 'Fur coat';
  return (
    <div className="studio-tab">
      {(info.finishes ?? []).length > 0 && (
        <>
          <p className="eyebrow">Finishes</p>
          <div className="studio-chips" role="group" aria-label="Finishes">
            {(info.finishes ?? []).map((f) => {
              const rarity = rarityOf(info, { part: '', rarity: f.rarity });
              const lock = finishLock(f, info.materials, obtained, rarity, info.experience.level);
              const why = lock === 'obtain' ? `${f.blurb} ${rarity.name}: a keeper has to obtain this coat.` : lock ? `${f.blurb} Opens at level ${lock.level}.` : f.blurb;
              return (
                <button key={f.id} type="button" className="studio-chip" title={why} disabled={lock !== null} onClick={() => onLook(applyFinish(look, f))}>
                  <span className="studio-dot" style={{ background: rarity.color }} aria-hidden="true" />
                  {f.name}
                  <span className="muted small">{lock === 'obtain' ? `${rarity.name} · obtained only` : lock ? `Level ${lock.level}` : rarity.name}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {coat && (
        <>
          <p className="eyebrow">Coat</p>
          <div className="studio-chips" role="group" aria-label="Coat">
            <button type="button" className={`studio-chip ${coated ? '' : 'is-on'}`} aria-pressed={!coated} onClick={() => onLook(setCoat(look, coat, false))}>
              Smooth
              <span className="muted small">Standard</span>
            </button>
            <button type="button" className={`studio-chip ${coated ? 'is-on' : ''}`} aria-pressed={coated} disabled={!hasCoat} title={hasCoat ? `${coatName}, all over.` : `${coatName} is ${coatRarity.name.toLowerCase()}: a keeper has to obtain it.`} onClick={() => onLook(setCoat(look, coat, true))}>
              <span className="studio-dot" style={{ background: coatRarity.color }} aria-hidden="true" />
              {coatName}
              <span className="muted small">{hasCoat ? coatRarity.name : `${coatRarity.name} · obtained only`}</span>
            </button>
          </div>
        </>
      )}
      <p className="eyebrow">Choose a part of the body</p>
      <div className="studio-chips" role="listbox" aria-label="Body parts">
        {info.zones.map((z) => (
          <button key={z.id} type="button" role="option" aria-selected={zone === z.id} className={`studio-chip ${zone === z.id ? 'is-on' : ''}`} onClick={() => onZone(zone === z.id ? null : z.id)}>
            {look[z.id]?.color && <span className="studio-dot" style={{ background: look[z.id]?.color }} />}
            {z.name}
          </button>
        ))}
      </div>
      {zone ? (
        <>
          <p className="eyebrow">Colour</p>
          <div className="studio-swatches">
            {SWATCHES.map((c) => (
              <button key={c} type="button" className={`studio-swatch ${current.color === c ? 'is-on' : ''}`} style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => onLook(setZone(look, zone, { color: c }))} />
            ))}
            <label className="studio-swatch studio-custom" title="Any colour">
              <input type="color" value={current.color ?? '#d39744'} onChange={(e) => onLook(setZone(look, zone, { color: e.target.value }))} aria-label="Any colour" />+
            </label>
          </div>
          <p className="eyebrow">Material</p>
          <div className="studio-chips">
            {info.materials
              // A coat material shows only to a keeper that has it (it is obtained, never picked).
              .filter((m) => !m.obtainedOnly || obtained.includes(m.id) || current.material === m.id)
              .map((m) => (
                <button key={m.id} type="button" className={`studio-chip ${current.material === m.id ? 'is-on' : ''}`} onClick={() => onLook(setZone(look, zone, { material: m.id }))}>
                  {m.obtainedOnly && <span className="studio-dot" style={{ background: rarityOf(info, { part: '', rarity: m.rarity }).color }} aria-hidden="true" />}
                  {m.name}
                </button>
              ))}
          </div>
          <button type="button" className="link small" onClick={() => onLook(setZone(look, zone, null))}>
            Back to the original colour
          </button>
        </>
      ) : (
        <p className="muted small">Pick a part and the stage zooms in on it.</p>
      )}
    </div>
  );
}
