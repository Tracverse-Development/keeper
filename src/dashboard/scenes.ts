/**
 * Scenes (pure; tested): every answer that showed panels is a scene the person can return to.
 * A chat's scenes are rebuilt from its turns on the DKG (each turn keeps its panels), titled by
 * the first panel, and their panel ids are made unique per scene so the Stage never confuses one
 * scene's panels with another's.
 */
import type { Turn } from '../kernel/ipc';
import type { Panel } from '../kernel/panel-spec';

export interface Scene {
  id: string;
  title: string;
  panels: Panel[];
}

const TITLE_MAX = 48;

export function sceneTitle(panels: Panel[], fallback: string): string {
  const t = (panels[0]?.title ?? '').trim() || fallback.trim() || 'Scene';
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1)}…` : t;
}

/** Panels with ids unique to their scene. */
export function scoped(sceneId: string, panels: Panel[]): Panel[] {
  return panels.map((p, i) => ({ ...p, id: `${sceneId}:${p.id || i}` }));
}

export function makeScene(id: string, panels: Panel[], said: string): Scene {
  return { id, title: sceneTitle(panels, said), panels: scoped(id, panels) };
}

/** A chat's scenes, oldest first, from its stored turns. */
export function scenesFromTurns(turns: Turn[]): Scene[] {
  return turns.filter((t) => (t.panels?.length ?? 0) > 0).map((t) => makeScene(t.id, t.panels ?? [], t.said));
}
