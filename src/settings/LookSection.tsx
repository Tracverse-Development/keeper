/** The character's look: one card per skin in the character module's registry. */
import { SKINS } from '../character';

export function LookSection({ value, onPick }: { value: string; onPick: (skin: string) => void }) {
  return (
    <div className="looks" role="radiogroup" aria-label="Look">
      {SKINS.map((s) => (
        <button key={s.id} type="button" role="radio" aria-checked={value === s.id} className={`mind look ${value === s.id ? 'is-on' : ''}`} onClick={() => onPick(s.id)}>
          <strong>{s.name}</strong>
          <span className="mind-body">{s.description}</span>
        </button>
      ))}
    </div>
  );
}
