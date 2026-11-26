/**
 * Reading: the size of all text in Keeper (Normal, Large, Larger), for this device. Changes at
 * once; motion follows the Mac's own "Reduce motion" setting.
 */
import { useState } from 'react';

import { applyTextSize, readTextSize, TEXT_SIZES, type TextSizeId } from '../kernel/text-size';

export function ReadingSection() {
  const [size, setSize] = useState<TextSizeId>(readTextSize);
  return (
    <div className="section">
      <div className="segmented" role="radiogroup" aria-label="Text size">
        {TEXT_SIZES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={size === s.id}
            className={size === s.id ? 'is-on' : ''}
            onClick={() => {
              applyTextSize(s.id);
              setSize(s.id);
            }}
          >
            {s.name}
          </button>
        ))}
      </div>
      <p className="muted small">All text in Keeper grows together. Movement follows your Mac's "Reduce motion" setting (System Settings, Accessibility, Display).</p>
    </div>
  );
}
