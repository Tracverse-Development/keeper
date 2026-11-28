/**
 * What the dashboard hears from the core besides its own turns: the memory node's health and
 * counts (for the top bar, every 30 s while visible), memory writes (the character's halo
 * pulses), reminders the keeper speaks by itself, turns from the phone link, and an installed
 * update. Also the person's first name from the active keeper's graph, for touch replies.
 */
import { useEffect, useState } from 'react';

import { core, EVENTS, on, type Counts, type NodeStatus, type TurnResult } from '../kernel/ipc';
import { nameFromFacts } from './person-name';

/** How long the character celebrates after remembering or doing something. */
export const HAPPY_MS = 1800;
const HEALTH_EVERY_MS = 30_000;
/** Coming back to the window looks for an update, at most this often. */
const UPDATE_ON_FOCUS_MS = 10 * 60_000;

interface Hooks {
  keeper: string | null;
  assistant: { announce: (text: string, label?: string) => void; record: (said: string, result: TurnResult) => void };
  onCelebrate: () => void;
}

export function useDashboardEvents({ keeper, assistant, onCelebrate }: Hooks) {
  const [node, setNode] = useState<NodeStatus | null>(null);
  const [nodeChecked, setNodeChecked] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [personName, setPersonName] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  const [updated, setUpdated] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const refreshHealth = () => {
    if (!keeper) return;
    core
      .overview(keeper)
      .then((o) => {
        setNode(o.node);
        setCounts(o.counts);
        setPersonName(nameFromFacts(o.facts));
      })
      .catch(() => setNode(null))
      .finally(() => setNodeChecked(true));
  };

  useEffect(() => {
    refreshHealth();
    const timer = window.setInterval(() => {
      if (!document.hidden) refreshHealth();
    }, HEALTH_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [keeper]);

  useEffect(() => {
    const offWritten = on(EVENTS.memoryWritten, () => {
      setPulse((p) => p + 1);
      setNow(Date.now());
    });
    const offSays = on<{ text: string; reason?: string }>(EVENTS.assistantSays, (s) => {
      assistant.announce(s.text, s.reason === 'calendar' ? 'Coming up' : 'Reminder');
      onCelebrate();
    });
    const offPhone = on<{ said: string; result: TurnResult }>(EVENTS.phoneTurn, (p) => assistant.record(p.said, p.result));
    const offUpdate = on<{ version: string }>(EVENTS.appUpdate, (u) => setUpdated(u.version));
    // Back at the window: look for an update (the core installs it; `app://update` says when).
    let lastCheck = Date.now();
    const onFocus = () => {
      if (Date.now() - lastCheck < UPDATE_ON_FOCUS_MS) return;
      lastCheck = Date.now();
      core.updateCheck().catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    // The mood rule needs the time to end a celebration; a slow tick is enough.
    const tick = window.setInterval(() => setNow(Date.now()), 500);
    return () => {
      offWritten();
      offSays();
      offPhone();
      offUpdate();
      window.clearInterval(tick);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  /** The engine's display name for the working pipeline ("Claude Code"). */
  const mindLabel = (brain?: string) => ({ claude: 'Claude Code', codex: 'Codex', gemini: 'Gemini', hermes: 'Hermes', ollama: 'a local model', reflex: 'the built-in mind' } as Record<string, string>)[brain ?? ''] ?? '';

  return { node, nodeChecked, counts, personName, pulse, updated, now, refreshHealth, mindLabel };
}
