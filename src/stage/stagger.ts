/**
 * The stagger index for entrance animations: sets `--i` on an element, and stage.css delays its
 * animation by `--i` steps, so pieces arrive one after another.
 */
import type { CSSProperties } from 'react';

export function stagger(i: number): CSSProperties {
  return { '--i': i } as CSSProperties;
}
