/**
 * The Stage's state on the dashboard: the chat's SCENES (one per answer that showed panels; back
 * and forward between them; rebuilt from the DKG when a chat is reopened), panels STREAMING in
 * while the engine writes (`stage://panel`), the agent's live tool calls, the work level the
 * character shows (phase + the computer's load, polled only while a turn runs), and whether the
 * stage is open (closing keeps the scenes; they can be reopened).
 */
import { useEffect, useRef, useState } from 'react';

import { core, EVENTS, on, type Phase, type SystemLoad, type Turn, type TurnResult } from '../kernel/ipc';
import type { Panel } from '../kernel/panel-spec';
import { CHANGED_COURSE } from '../stage/activity.ts';
import { makeScene, parentIndex, scenesFromTurns, scoped, type Scene } from './scenes';
import { workLevel } from './work-level';

const LOAD_EVERY_MS = 1500;

export function useStageState(keeper: string | null, phase: Phase | null, detail: string, busy: boolean) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [current, setCurrent] = useState(0);
  const [live, setLive] = useState<Panel[]>([]);
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState<{ tool: string; detail: string }[]>([]);
  const [load, setLoad] = useState<SystemLoad | null>(null);
  const lastDetail = useRef('');
  const turnCount = useRef(0);

  // A new turn starts a fresh activity feed and live scene; each tool step joins the feed.
  useEffect(() => {
    if (phase === 'recalling') {
      setActivity([]);
      setLive([]);
      lastDetail.current = '';
      turnCount.current += 1;
    }
    if (phase === 'acting' && detail && detail !== lastDetail.current && detail.includes(':')) {
      lastDetail.current = detail;
      const [tool, ...rest] = detail.split(':');
      setActivity((a) => [...a, { tool: tool.trim(), detail: rest.join(':').trim() }].slice(-30));
    }
  }, [phase, detail]);

  // A correction the keeper took joins the feed as a marker where it happened; the new run's
  // first step shows even if it repeats the last one before the change.
  useEffect(
    () =>
      on<{ phase: Phase; detail: string }>(EVENTS.assistantPhase, (p) => {
        if (p.phase !== 'redirected') return;
        lastDetail.current = '';
        setActivity((a) => [...a, { tool: CHANGED_COURSE, detail: p.detail }].slice(-30));
      }),
    [],
  );

  // Panels as the engine finishes each one: the stage opens on the first.
  useEffect(
    () =>
      on<{ keeper: string; panel: Panel }>(EVENTS.stagePanel, (e) => {
        if (e.keeper !== keeper) return;
        setLive((l) => [...l, ...scoped(`live-${turnCount.current}`, [e.panel])]);
        setOpen(true);
      }),
    [keeper],
  );

  // The computer's load, only while the keeper works (no polling when idle).
  useEffect(() => {
    if (!busy) {
      setLoad(null);
      return;
    }
    const read = () => core.systemLoad().then(setLoad).catch(() => setLoad(null));
    read();
    const t = window.setInterval(read, LOAD_EVERY_MS);
    return () => window.clearInterval(t);
  }, [busy]);

  const streaming = busy && live.length > 0;
  const panels = streaming ? live : (scenes[current]?.panels ?? []);
  const reset = () => {
    setScenes([]);
    setCurrent(0);
    setLive([]);
    setActivity([]);
    setOpen(false);
  };

  return {
    panels,
    activity,
    scenes,
    current: streaming ? Math.max(0, scenes.length) : current,
    tabs: (streaming ? [...scenes, { id: 'live', title: 'Arriving…', panels: live }] : scenes).map((s, i, all) => ({ ...s, parentAt: parentIndex(all, i) })),
    open,
    work: workLevel(busy ? (phase ?? 'thinking') : null, load),
    /** The stage is on screen: the keepers panel steps aside. */
    // Open with something to show, or working on an open lesson, or the agent visibly working.
    showing: (open && (panels.length > 0 || busy)) || (busy && (activity.length > 0 || live.length > 0)),
    /** A finished answer: its panels become the newest scene. */
    take: (r: TurnResult, said: string) => {
      setLive([]);
      if (r.panels.length === 0) return;
      setScenes((s) => {
        setCurrent(s.length);
        return [...s, makeScene(`${r.chat}-${Date.now()}`, r.panels, said)];
      });
      setOpen(true);
    },
    /** A chat reopened from the keepers panel: its scenes come back from the DKG. */
    fromTurns: (turns: Turn[]) => {
      const restored = scenesFromTurns(turns);
      setScenes(restored);
      setCurrent(Math.max(0, restored.length - 1));
      setLive([]);
      setOpen(restored.length > 0);
    },
    /** Put a scene (a pinned one) on the stage as the newest scene. */
    show: (scene: Scene) => {
      setScenes((s) => {
        setCurrent(s.length);
        return [...s, scene];
      });
      setOpen(true);
    },
    goTo: (i: number) => setCurrent(i),
    close: () => setOpen(false),
    reopen: () => setOpen(true),
    reset,
  };
}
