/**
 * Look: pick a paint zone (the stage zooms to it), then its colour and material. Changes are a
 * draft until the Studio saves them.
 */
import type { StudioInfo, ZoneLook } from '../kernel/ipc-studio';
import { setZone, SWATCHES } from './studio-view';

interface Props {
  info: StudioInfo;
  look: Record<string, ZoneLook>;
  zone: string | null;
  onZone: (zone: string | null) => void;
  onLook: (look: Record<string, ZoneLook>) => void;
}

export function LookTab({ info, look, zone, onZone, onLook }: Props) {
  const current = zone ? look[zone] ?? {} : {};
  return (
    <div className="studio-tab">
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
            {info.materials.map((m) => (
              <button key={m.id} type="button" className={`studio-chip ${current.material === m.id ? 'is-on' : ''}`} onClick={() => onLook(setZone(look, zone, { material: m.id }))}>
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
