/**
 * How hard the keeper looks like it is working (0..1), from the turn's phase and the computer's
 * load (pure; tested). Thinking is a steady hum; acting on the computer runs hotter; a busy
 * machine (CPU, and memory a little) pushes it toward "overheating".
 */
import type { Phase, SystemLoad } from '../kernel/ipc';

const BASE: Record<string, number> = { recalling: 0.25, thinking: 0.35, acting: 0.55, remembering: 0.3 };

export function workLevel(phase: Phase | null, load: SystemLoad | null): number {
  const base = phase ? BASE[phase] ?? 0 : 0;
  if (base === 0) return 0;
  const strain = load ? Math.max(load.cpu, load.memory * 0.6) / 100 : 0;
  return Math.min(1, base + strain * 0.45);
}
