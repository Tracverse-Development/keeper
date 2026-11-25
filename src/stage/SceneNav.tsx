/**
 * The scene navigator in the Stage header: each answer that showed panels is a scene (the four
 * building blocks, then Addition, then Subtraction…). Back and forward step through them, and the
 * title opens the list to jump straight to one. Quiet by design: one line, no clutter.
 * Pins (`ScenePins`): the pin button keeps the scene on hand in every chat, and the list's
 * "Pinned" section reopens any pinned scene.
 */
import { useState } from 'react';

import { Icon } from './icons.tsx';

export interface SceneTab {
  id: string;
  title: string;
  /** The scene this one was opened from (index), for the breadcrumb; -1 or absent: none. */
  parentAt?: number;
}

/** Pinned scenes, supplied by the dashboard (they live on the keeper's graph). */
export interface ScenePins {
  list: SceneTab[];
  /** The scene on screen is pinned. */
  currentPinned: boolean;
  /** Pin the scene on screen, or unpin it. */
  toggle: () => void;
  open: (id: string) => void;
}

interface Props {
  scenes: SceneTab[];
  current: number;
  onScene: (index: number) => void;
  pins?: ScenePins;
}

export function SceneNav({ scenes, current, onScene, pins }: Props) {
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
      {(scenes[current]?.parentAt ?? -1) >= 0 && (
        <button type="button" className="scene-crumb" onClick={() => go(scenes[current].parentAt ?? -1)} title="Back to the scene this came from">
          {scenes[scenes[current].parentAt ?? 0]?.title}
          <span aria-hidden> ›</span>
        </button>
      )}
      <button type="button" className="scene-title" onClick={() => setListOpen((o) => !o)} aria-expanded={listOpen} title="All scenes in this chat">
        <span className="scene-name">{scenes[current]?.title || 'Scene'}</span>
        <span className="scene-count">
          {current + 1} / {scenes.length}
        </span>
      </button>
      <button type="button" className="scene-step" onClick={() => go(current + 1)} disabled={current >= scenes.length - 1} aria-label="Next scene">
        <Icon name="next" size={14} />
      </button>
      {pins && (
        <button type="button" className={`scene-step scene-pin ${pins.currentPinned ? 'is-on' : ''}`} onClick={pins.toggle} aria-pressed={pins.currentPinned} title={pins.currentPinned ? 'Unpin this scene' : 'Pin this scene to every chat'}>
          <Icon name="pin" size={14} />
        </button>
      )}
      {listOpen && (
        <ol className="scene-list glass">
          {scenes.map((s, i) => (
            <li key={s.id}>
              <button type="button" className={i === current ? 'is-on' : ''} onClick={() => go(i)}>
                <span className="scene-index">{i + 1}</span> {s.title}
              </button>
            </li>
          ))}
          {pins && pins.list.length > 0 && (
            <>
              <li className="scene-list-head">Pinned</li>
              {pins.list.map((p) => (
                <li key={`pin-${p.id}`}>
                  <button type="button" onClick={() => { setListOpen(false); pins.open(p.id); }}>
                    <span className="scene-index"><Icon name="pin" size={11} /></span> {p.title}
                  </button>
                </li>
              ))}
            </>
          )}
        </ol>
      )}
    </nav>
  );
}
