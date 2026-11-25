/**
 * The everyday screen: the character fills the window, the conversation dock sits under it,
 * the memory drawer and settings open over it. This file only composes; behaviour lives in
 * the hooks (`useAssistant`, `useVoice`) and the pure mood rule (`mood.ts`).
 */
import { useEffect, useRef, useState } from 'react';

import { CharacterStage } from '../character';
import { ConversationDock } from '../conversation/ConversationDock';
import { useAssistant } from '../conversation/useAssistant';
import { core, EVENTS, on, type Counts, type NodeStatus, type Saved, type Settings, type TurnResult } from '../kernel/ipc';
import { MemoryDrawer } from '../memory/MemoryDrawer';
import { SettingsSheet } from '../settings/SettingsSheet';
import { useVoice } from '../voice/useVoice';
import { moodFor, phaseWords } from './mood';
import { TopBar } from './TopBar';
import { nameFromFacts, touchLine, type Touch } from './touch-lines';
import { UpdateBanner } from './UpdateBanner';
import './dashboard.css';

/** How long the character celebrates after remembering or doing something. */
const HAPPY_MS = 1800;
/** How often the top bar re-reads the node's health while the window is open. */
const HEALTH_EVERY_MS = 30_000;
/** One touch reaction at a time; a burst of clicks is one poke. */
const TOUCH_GAP_MS = 1500;

export function Dashboard({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState(initial);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [node, setNode] = useState<NodeStatus | null>(null);
  const [nodeChecked, setNodeChecked] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [pulse, setPulse] = useState(0);
  const [happyUntil, setHappyUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [updated, setUpdated] = useState<string | null>(null);
  const speakRef = useRef<(t: string) => void>(() => undefined);
  const personName = useRef<string | null>(null);
  const lastTouch = useRef<{ at: number; line: string | null }>({ at: 0, line: null });

  const afterReply = (r: TurnResult) => {
    if (r.learned.length || r.actions.some((a) => a.succeeded)) setHappyUntil(Date.now() + HAPPY_MS);
    speakRef.current(r.reply);
    refreshHealth();
  };
  const assistant = useAssistant(afterReply);
  const voice = useVoice((text) => assistant.send(text));
  speakRef.current = voice.speak;

  const refreshHealth = () =>
    core
      .overview()
      .then((o) => {
        setNode(o.node);
        setCounts(o.counts);
        personName.current = nameFromFacts(o.facts);
      })
      .catch(() => setNode(null))
      .finally(() => setNodeChecked(true));

  useEffect(() => {
    refreshHealth();
    const timer = window.setInterval(() => {
      if (!document.hidden) refreshHealth();
    }, HEALTH_EVERY_MS);
    const offWritten = on(EVENTS.memoryWritten, () => setPulse((p) => p + 1));
    const offSays = on<{ text: string }>(EVENTS.assistantSays, (s) => {
      assistant.announce(s.text, 'Reminder');
      setHappyUntil(Date.now() + HAPPY_MS);
    });
    const offPhone = on<{ said: string; result: TurnResult }>(EVENTS.phoneTurn, (p) => assistant.record(p.said, p.result));
    const offUpdate = on<{ version: string }>(EVENTS.appUpdate, (u) => setUpdated(u.version));
    return () => {
      window.clearInterval(timer);
      offWritten();
      offSays();
      offPhone();
      offUpdate();
    };
  }, []);

  // Re-evaluate the celebration's end without a render loop.
  useEffect(() => {
    if (happyUntil <= Date.now()) return;
    const t = window.setTimeout(() => setNow(Date.now()), happyUntil - Date.now() + 20);
    return () => window.clearTimeout(t);
  }, [happyUntil]);

  const mood = moodFor({ speaking: voice.speaking, listening: voice.listening, phase: assistant.phase, happyUntil, now: Math.max(now, Date.now() - 1) });
  const stop = () => {
    voice.stop();
    voice.hush();
  };

  /** A poke or a pat on the character: it answers in its own words, out loud. */
  const touched = (kind: Touch) => {
    const now = Date.now();
    if (now - lastTouch.current.at < TOUCH_GAP_MS || assistant.busy) return;
    const line = touchLine(kind, { name: settings.assistantName, you: personName.current, last: lastTouch.current.line });
    lastTouch.current = { at: now, line };
    if (kind === 'pat') setHappyUntil(now + HAPPY_MS);
    assistant.announce(line, settings.assistantName);
    voice.speak(line);
  };

  /** A saved setting; an engine change comes back with the assistant's words about its new brain. */
  const saved = (s: Saved) => {
    setSettings(s.settings);
    if (s.announcement) {
      setSettingsOpen(false);
      setHappyUntil(Date.now() + HAPPY_MS);
      assistant.announce(s.announcement, settings.assistantName);
      voice.speak(s.announcement);
    }
  };

  return (
    <main className="dashboard">
      <CharacterStage className="stage" skin={settings.skin} mood={mood} voiceLevel={voice.level} mouth={voice.mouth} memoryPulse={pulse} onTouch={(kind) => touched(kind)} />
      {updated && <UpdateBanner version={updated} />}
      <TopBar
        assistantName={settings.assistantName}
        node={node}
        nodeChecked={nodeChecked}
        counts={counts}
        alwaysListening={settings.alwaysListening}
        onMemory={() => setMemoryOpen((o) => !o)}
        onSettings={() => setSettingsOpen(true)}
      />
      <ConversationDock
        exchanges={assistant.exchanges}
        busy={assistant.busy}
        status={phaseWords(assistant.phase, settings.graphId, assistant.detail)}
        listening={voice.listening}
        speaking={voice.speaking}
        partial={voice.partial}
        voiceError={voice.error}
        assistantName={settings.assistantName}
        onSend={assistant.send}
        onMic={voice.listen}
        onStop={stop}
      />
      <MemoryDrawer open={memoryOpen} onClose={() => setMemoryOpen(false)} refreshKey={pulse} />
      <SettingsSheet open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} onSaved={saved} />
    </main>
  );
}
