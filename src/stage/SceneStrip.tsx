/**
 * The scene strip along the stage's bottom edge: one chip per scene in this chat, the current one
 * lit, follow-ups indented under the scene they came from, so the whole path is visible and one
 * click away. ← and → step through scenes from anywhere on the stage (not while typing).
 */
import { useEffect } from 'react';

import type { SceneTab } from './SceneNav.tsx';

interface Props {
  scenes: SceneTab[];
  current: number;
  onScene: (index: number) => void;
}

/** Arrow keys step through scenes unless the person is typing somewhere. */
function useArrowKeys(count: number, current: number, onScene: (i: number) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft' && current > 0) onScene(current - 1);
      if (e.key === 'ArrowRight' && current < count - 1) onScene(current + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, current, onScene]);
}

export function SceneStrip({ scenes, current, onScene }: Props) {
  useArrowKeys(scenes.length, current, onScene);
  if (scenes.length < 2) return null;
  return (
    <nav className="scene-strip" aria-label="Scenes in this chat">
      {scenes.map((s, i) => (
        <button
          key={s.id}
          type="button"
          className={`scene-chip ${i === current ? 'is-on' : ''} ${(s.parentAt ?? -1) >= 0 ? 'is-follow' : ''}`}
          onClick={() => onScene(i)}
          aria-current={i === current ? 'step' : undefined}
          title={s.title}
        >
          <span className="scene-chip-n">{i + 1}</span>
          <span className="scene-chip-title">{s.title}</span>
        </button>
      ))}
    </nav>
  );
}
