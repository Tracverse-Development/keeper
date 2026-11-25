/**
 * The Stage's state on the dashboard: the panels of the latest answer (kept until closed), the
 * agent's live tool calls while it works (from the turn's "acting" phases), the work level the
 * character shows (phase + the computer's load, polled only while a turn runs), and whether the
 * keepers panel should step aside for the stage.
 */
import { useEffect, useRef, useState } from 'react';

import { core, type Phase, type SystemLoad, type TurnResult } from '../kernel/ipc';
import type { Panel } from '../kernel/panel-spec';
import { workLevel } from './work-level';

const LOAD_EVERY_MS = 1500;

export function useStageState(phase: Phase | null, detail: string, busy: boolean) {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [activity, setActivity] = useState<{ tool: string; detail: string }[]>([]);
  const [load, setLoad] = useState<SystemLoad | null>(null);
  const lastDetail = useRef('');

  // A new turn starts a fresh activity feed; each tool step ("Bash: ls ~/Desktop") joins it.
  useEffect(() => {
    if (phase === 'recalling') {
      setActivity([]);
      lastDetail.current = '';
    }
    if (phase === 'acting' && detail && detail !== lastDetail.current && detail.includes(':')) {
      lastDetail.current = detail;
      const [tool, ...rest] = detail.split(':');
      setActivity((a) => [...a, { tool: tool.trim(), detail: rest.join(':').trim() }].slice(-30));
    }
  }, [phase, detail]);

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

  return {
    panels,
    activity,
    work: workLevel(busy ? phase ?? 'thinking' : null, load),
    /** The stage is showing something: the keepers panel steps aside. */
    showing: panels.length > 0 || (busy && activity.length > 0),
    take: (r: TurnResult) => {
      if (r.panels.length > 0) setPanels(r.panels);
    },
    close: () => {
      setPanels([]);
      setActivity([]);
    },
  };
}
