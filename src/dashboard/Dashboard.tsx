/**
 * The everyday screen: the active keeper fills the window, the keepers panel (keepers and their
 * chats) sits on the left, the conversation dock under the character, the memory drawer and
 * settings open over it. This file only composes; behaviour lives in the hooks (`useKeepers`,
 * `useChats`, `useAssistant`, `useVoice`, `useDashboardEvents`) and the pure rules (`mood.ts`,
 * `touch-lines.ts`).
 */
import { useRef, useState } from 'react';

import { CharacterStage } from '../character';
import { ConversationDock } from '../conversation/ConversationDock';
import { useAssistant } from '../conversation/useAssistant';
import { sentence, type KeeperChange, type Settings, type TurnResult } from '../kernel/ipc';
import { KeeperSidebar } from '../keepers/KeeperSidebar';
import { useChats } from '../keepers/useChats';
import { useKeepers } from '../keepers/useKeepers';
import { MemoryDrawer } from '../memory/MemoryDrawer';
import { SettingsSheet } from '../settings/SettingsSheet';
import { useVoice } from '../voice/useVoice';
import { moodFor, phaseWords } from './mood';
import { TopBar } from './TopBar';
import { touchLine, type Touch } from './touch-lines';
import { UpdateBanner } from './UpdateBanner';
import { HAPPY_MS, useDashboardEvents } from './useDashboardEvents';
import './dashboard.css';

/** One touch reaction at a time; a burst of clicks is one poke. */
const TOUCH_GAP_MS = 1500;

export function Dashboard({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState(initial);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [happyUntil, setHappyUntil] = useState(0);
  const lastTouch = useRef<{ at: number; line: string | null }>({ at: 0, line: null });
  const speakRef = useRef<(t: string) => void>(() => undefined);

  const keepers = useKeepers();
  const keeper = keepers.active;
  const chats = useChats(keeper?.id ?? null);
  const celebrate = () => setHappyUntil(Date.now() + HAPPY_MS);

  const assistant = useAssistant(keeper?.id ?? null, (r: TurnResult) => {
    if (r.learned.length || r.actions.some((a) => a.succeeded)) celebrate();
    speakRef.current(r.reply);
    events.refreshHealth();
    chats.refresh();
  });

  // A spoken command may name another keeper ("Hey Pup, …"): switch to it, then send.
  const voice = useVoice((text, toKeeper) => {
    if (toKeeper && toKeeper !== keeper?.id) {
      keepers.activate(toKeeper).then(() => assistant.send(text, toKeeper)).catch(() => undefined);
    } else {
      assistant.send(text);
    }
  });
  speakRef.current = voice.speak;

  const events = useDashboardEvents({ keeper: keeper?.id ?? null, assistant, onCelebrate: celebrate });

  const mood = moodFor({ speaking: voice.speaking, listening: voice.listening, phase: assistant.phase, happyUntil, now: events.now });
  const name = keeper?.name ?? 'Keeper';

  const stop = () => {
    voice.stop();
    voice.hush();
  };

  /** A poke or a pat on the character: it answers in its own words, out loud. */
  const touched = (kind: Touch) => {
    const now = Date.now();
    if (now - lastTouch.current.at < TOUCH_GAP_MS || assistant.busy) return;
    const line = touchLine(kind, { name, you: events.personName, last: lastTouch.current.line });
    lastTouch.current = { at: now, line };
    if (kind === 'pat') celebrate();
    assistant.announce(line, name);
    voice.speak(line);
  };

  /** Edit the active keeper; a new brain comes back with its words about it. */
  const changeKeeper = async (change: KeeperChange) => {
    if (!keeper) return;
    try {
      const said = await keepers.update(keeper.id, change);
      if (said) {
        setSettingsOpen(false);
        celebrate();
        assistant.announce(said, name);
        voice.speak(said);
      }
    } catch (e) {
      assistant.announce(sentence(e), name);
    }
  };

  const openChat = (id: string) =>
    chats
      .open(id)
      .then((turns) => assistant.showChat(id, turns))
      .catch((e) => assistant.announce(sentence(e), name));

  return (
    <main className={`dashboard ${panelOpen ? 'has-panel' : ''}`}>
      <CharacterStage className="stage" skin={keeper?.skin ?? 'robot'} mood={mood} voiceLevel={voice.level} mouth={voice.mouth} memoryPulse={events.pulse} onTouch={(kind) => touched(kind)} />
      {events.updated && <UpdateBanner version={events.updated} />}
      <TopBar
        assistantName={name}
        node={events.node}
        nodeChecked={events.nodeChecked}
        counts={events.counts}
        alwaysListening={settings.alwaysListening}
        openMic={!settings.wakeWord}
        onMemory={() => setMemoryOpen((o) => !o)}
        onSettings={() => setSettingsOpen(true)}
      />
      <KeeperSidebar
        keepers={keepers.list?.keepers ?? []}
        active={keeper}
        domains={keepers.list?.domains ?? []}
        chats={chats.chats}
        chatId={assistant.chatId}
        open={panelOpen}
        error={chats.error ?? keepers.error}
        onToggle={() => setPanelOpen((o) => !o)}
        onActivate={(id) => keepers.activate(id).catch(() => undefined)}
        onNewChat={assistant.newChat}
        onOpenChat={openChat}
        onCreate={(k) => keepers.create(k)}
      />
      <ConversationDock
        exchanges={assistant.exchanges}
        busy={assistant.busy}
        status={phaseWords(assistant.phase, keeper?.graphId ?? '', assistant.detail)}
        listening={voice.listening}
        speaking={voice.speaking}
        partial={voice.partial}
        voiceError={voice.error}
        assistantName={name}
        full={panelOpen && assistant.chatId !== ''}
        onSend={(t) => assistant.send(t)}
        onMic={voice.listen}
        onStop={stop}
      />
      {keeper && <MemoryDrawer open={memoryOpen} keeper={keeper.id} onClose={() => setMemoryOpen(false)} refreshKey={events.pulse} />}
      {keeper && (
        <SettingsSheet
          open={settingsOpen}
          settings={settings}
          keeper={keeper}
          onClose={() => setSettingsOpen(false)}
          onSaved={setSettings}
          onKeeperChange={changeKeeper}
          onRemoveKeeper={keepers.list && keepers.list.keepers.length > 1 ? () => keepers.remove(keeper.id).then(() => setSettingsOpen(false)) : undefined}
        />
      )}
    </main>
  );
}

