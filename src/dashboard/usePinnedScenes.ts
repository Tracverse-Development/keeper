/**
 * Pinned scenes for the keeper on screen: loaded from its graph, pinned or unpinned from the
 * scene navigator, and reopened in any chat (a pinned scene joins the chat's scenes as the
 * newest one). Whether the scene on screen is pinned is decided by `sceneSignature`.
 */
import { useEffect, useState } from 'react';

import { core, sentence, type PinnedScene } from '../kernel/ipc';
import type { ScenePins } from '../stage/SceneNav';
import { makeScene, sceneSignature, type Scene } from './scenes';

interface Deps {
  keeper: string | null;
  /** The scene on screen, if any. */
  current: Scene | undefined;
  /** Put a scene on the stage as the newest one. */
  show: (scene: Scene) => void;
  onError: (message: string) => void;
}

export function usePinnedScenes({ keeper, current, show, onError }: Deps): ScenePins & { count: number; openLatest: () => void } {
  const [pinned, setPinned] = useState<PinnedScene[]>([]);

  useEffect(() => {
    setPinned([]);
    if (keeper) core.pinnedScenes(keeper).then(setPinned).catch(() => undefined);
  }, [keeper]);

  const signature = current ? sceneSignature(current.title, current.panels) : '';
  const match = pinned.find((p) => sceneSignature(p.title, p.panels) === signature);

  const toggle = async () => {
    if (!current || !keeper) return;
    try {
      if (match) {
        await core.unpinScene(match.id, keeper);
        setPinned((list) => list.filter((p) => p.id !== match.id));
      } else {
        const pin = await core.pinScene(current.title, current.panels, keeper);
        setPinned((list) => [pin, ...list.filter((p) => p.id !== pin.id)]);
      }
    } catch (e) {
      onError(sentence(e));
    }
  };

  const open = (id: string) => {
    const pin = pinned.find((p) => p.id === id);
    if (pin) show({ ...makeScene(`pin-${pin.id}-${Date.now()}`, pin.panels, pin.title), title: pin.title });
  };

  return {
    list: pinned.map((p) => ({ id: p.id, title: p.title })),
    currentPinned: Boolean(match),
    toggle: () => void toggle(),
    open,
    count: pinned.length,
    openLatest: () => pinned[0] && open(pinned[0].id),
  };
}
