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
  /** The scene it was opened from (a follow-up on a card or panel: "About \"X\": …"). */
  parent?: string;
}

/** The panel a follow-up was asked about (`focusQuestion` starts 'About "<panel title>": '). */
export function parentTitle(said: string): string | undefined {
  const m = /^About "([^"]{1,120})":/.exec(said.trim());
  return m?.[1];
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
  return { id, title: sceneTitle(panels, said), panels: scoped(id, panels), parent: parentTitle(said) };
}

/** The scene a breadcrumb points back to: the newest earlier scene with a panel of that title. */
export function parentIndex(scenes: Scene[], current: number): number {
  const parent = scenes[current]?.parent;
  if (!parent) return -1;
  for (let i = current - 1; i >= 0; i--) {
    if (scenes[i].title === parent || scenes[i].panels.some((p) => p.title === parent)) return i;
  }
  return -1;
}

/** A chat's scenes, oldest first, from its stored turns. */
export function scenesFromTurns(turns: Turn[]): Scene[] {
  return turns.filter((t) => (t.panels?.length ?? 0) > 0).map((t) => makeScene(t.id, t.panels ?? [], t.said));
}

/**
 * What makes two scenes the same for pinning: the title and each panel's kind and title (panel
 * ids differ between a live scene, a restored one and a pinned copy).
 */
export function sceneSignature(title: string, panels: Panel[]): string {
  return [title, ...panels.map((p) => `${p.kind}:${p.title}`)].join('\u0000');
}
