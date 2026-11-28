/**
 * The screens opened now and then (memory, settings, Studio): each loads the first time it is
 * opened, so the window itself opens sooner, and stays loaded after that, so closing and
 * reopening keeps its animation. `useOpened` says which have ever been opened.
 */
import { lazy, useRef } from 'react';

export const MemoryDrawer = lazy(() => import('../memory/MemoryDrawer').then((m) => ({ default: m.MemoryDrawer })));
export const SettingsSheet = lazy(() => import('../settings/SettingsSheet').then((m) => ({ default: m.SettingsSheet })));
export const StudioPage = lazy(() => import('../studio/StudioPage').then((m) => ({ default: m.StudioPage })));

/** Which flags have ever been true: a screen loads the first time it is opened and stays. */
export function useOpened<K extends string>(now: Record<K, boolean>): Record<K, boolean> {
  const ever = useRef({} as Record<K, boolean>);
  for (const key of Object.keys(now) as K[]) if (now[key]) ever.current[key] = true;
  return ever.current;
}
