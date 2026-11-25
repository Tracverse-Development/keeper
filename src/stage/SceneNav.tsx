/**
 * The scene navigator in the Stage header: each answer that showed panels is a scene (the four
 * building blocks, then Addition, then Subtraction…). Back and forward step through them, and the
 * title opens the list to jump straight to one. Quiet by design: one line, no clutter.
 */
import { useState } from 'react';

import { Icon } from './icons.tsx';

export interface SceneTab {
  id: string;
  title: string;
}

interface Props {
  scenes: SceneTab[];
  current: number;
  onScene: (index: number) => void;
}

export function SceneNav({ scenes, current, onScene }: Props) {
  const [listOpen, setListOpen] = useState(false);
  if (scenes.length === 0) return null;
  const go = (i: number) => {
    setListOpen(false);
    if (i >= 0 && i < scenes.length) onScene(i);
  };
  return (
    <nav className="scene-nav" aria-label="Scenes">
      <button type="button" className="scene-step" onClick={() => go(current - 1)} disabled={current <= 0} aria-label="Previous scene">
        <Icon name="back" size={14} />
      </button>
      <button type="button" className="scene-title" onClick={() => setListOpen((o) => !o)} aria-expanded={listOpen} title="All scenes in this chat">
        <span className="scene-name">{scenes[current]?.title || 'Scene'}</span>
        <span className="scene-count">
          {current + 1} / {scenes.length}
        </span>
      </button>
      <button type="button" className="scene-step" onClick={() => go(current + 1)} disabled={current >= scenes.length - 1} aria-label="Next scene">
        <Icon name="next" size={14} />
      </button>
      {listOpen && (
        <ol className="scene-list glass">
          {scenes.map((s, i) => (
            <li key={s.id}>
              <button type="button" className={i === current ? 'is-on' : ''} onClick={() => go(i)}>
                <span className="scene-index">{i + 1}</span> {s.title}
              </button>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}
