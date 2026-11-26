/**
 * The everyday screen: the active keeper fills the window, the keepers panel (keepers and their
 * chats) sits on the left, the conversation dock under the character, the memory drawer and
 * settings open over it. This file only composes; behaviour lives in the hooks (`useKeepers`,
 * `useChats`, `useAssistant`, `useVoice`, `useDashboardEvents`) and the pure rules (`mood.ts`,
 * `person-name.ts`).
 */
import { useEffect, useRef, useState } from 'react';

import { CharacterStage, DEFAULT_WEARABLES, type Emote } from '../character';
import { ConversationDock } from '../conversation/ConversationDock';
import { HandedTray } from '../conversation/HandedTray';
import { ModeBar } from '../conversation/ModeBar';
import { useHanded } from '../conversation/useHanded';
import { useAssistant } from '../conversation/useAssistant';
import { core, sentence, type KeeperChange, type Settings, type TurnResult } from '../kernel/ipc';
import { KeeperSidebar } from '../keepers/KeeperSidebar';
import { useKit } from '../keepers/useKit';
import { focusQuestion } from '../kernel/panel-spec';
import { useChats } from '../keepers/useChats';
import { useKeepers } from '../keepers/useKeepers';
import { MemoryDrawer } from '../memory/MemoryDrawer';
import { CommandPalette } from '../palette/CommandPalette';
import { paletteCommands } from '../palette/palette-commands';
import { SettingsSheet } from '../settings/SettingsSheet';
import { StudioPage } from '../studio/StudioPage';
import { levelUpLine } from '../studio/studio-view';
import { useLevelUp } from '../studio/useLevelUp';
import { Stage } from '../stage/Stage';
import { useVoice } from '../voice/useVoice';
import { moodFor, phaseWords } from './mood';
import { TopBar } from './TopBar';
import type { Touch } from '../kernel/ipc';
import { UpdateBanner } from './UpdateBanner';
import { withFactHalo } from './halo';
import { HAPPY_MS, useDashboardEvents } from './useDashboardEvents';
import { FocusChip } from './FocusChip';
import { useFeeling } from './useFeeling';
import { usePanelActions } from './usePanelActions';
import { usePinnedScenes } from './usePinnedScenes';
import { useStageState } from './useStageState';
import './dashboard.css';

/** One touch reaction at a time; a burst of clicks is one poke. */
const TOUCH_GAP_MS = 1500;

export function Dashboard({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState(initial);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [happyUntil, setHappyUntil] = useState(0);
  const lastTouch = useRef(0);
  const speakRef = useRef<(t: string, queue?: boolean) => void>(() => undefined);

  const keepers = useKeepers();
  const keeper = keepers.active;
  const kit = useKit();
  const chats = useChats(keeper?.id ?? null);
  const celebrate = () => setHappyUntil(Date.now() + HAPPY_MS);
  // One-shot emotes on real events (each call plays once).
  const [emote, setEmote] = useState<{ name: Emote; n: number }>({ name: 'wave', n: 0 });
  const play = (name: Emote) => setEmote((e) => ({ name, n: e.n + 1 }));

  const assistant = useAssistant(keeper?.id ?? null, (r: TurnResult, said: string) => {
    stage.take(r, said);
    if (r.learned.length) {
      celebrate();
      play('celebrate');
    } else if (r.actions.some((a) => a.succeeded) || r.steps.length) {
      celebrate();
      play('nod');
    } else if (r.mind.fellBack) {
      play('surprised');
    }
    actions.speakFinal(r.reply);
    body.refresh();
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

  useLevelUp(keeper?.id ?? null, (level, unlocked) => {
    const line = levelUpLine(keeper?.name ?? 'Keeper', level, unlocked);
    celebrate();
    play('celebrate');
    assistant.celebrate(line, keeper?.name ?? 'Keeper');
    speakRef.current(line, true);
  });
  const events = useDashboardEvents({ keeper: keeper?.id ?? null, assistant, onCelebrate: celebrate });
  // The next turn's engine starts before the person speaks: on opening, on switching keeper, and
  // whenever the window comes back to the front (a spare retires after 20 minutes).
  useEffect(() => {
    const warm = () => void core.warm(keeper?.id).catch(() => undefined);
    warm();
    window.addEventListener('focus', warm);
    return () => window.removeEventListener('focus', warm);
  }, [keeper?.id]);
  const actions = usePanelActions({
    keeper: keeper?.id ?? null,
    speak: (t, queue) => speakRef.current(t, queue),
    celebrate,
    streak: () => play('streak'),
    announce: (t) => assistant.announce(t, keeper?.name ?? 'Keeper'),
    decide: assistant.decide,
    brief: assistant.brief,
    send: (t) => void assistant.send(t),
    changed: events.refreshHealth,
  });
  // The halo starts with one node per fact this keeper holds, read once per keeper (a change of
  // effects re-dresses the character; new memories after that add nodes live through the pulse).
  const haloSeed = useRef<{ keeper: string; facts: number } | null>(null);
  if (keeper && events.counts && haloSeed.current?.keeper !== keeper.id) haloSeed.current = { keeper: keeper.id, facts: events.counts.facts };
  const worn = withFactHalo(keeper?.wearables ?? DEFAULT_WEARABLES, haloSeed.current?.keeper === keeper?.id ? (haloSeed.current?.facts ?? null) : null);
  const stage = useStageState(keeper?.id ?? null, assistant.phase, assistant.detail, assistant.busy);
  // Another keeper is a fresh stage; its scenes are its own.
  useEffect(() => stage.reset(), [keeper?.id]);
  // A keeper says hello when you switch to it.
  useEffect(() => {
    if (keeper?.id) play('wave');
  }, [keeper?.id]);
  const pins = usePinnedScenes({ keeper: keeper?.id ?? null, current: stage.scenes[stage.current], show: stage.show, onError: (m) => assistant.announce(m, keeper?.name ?? 'Keeper') });
  // The keepers panel steps aside (animated) while the stage shows a lesson or the agent's work.
  const sidebarOpen = panelOpen && !stage.showing;

  // ⌘K / Ctrl+K anywhere opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mood = moodFor({ speaking: voice.speaking, listening: voice.listening, phase: assistant.phase, happyUntil, now: events.now });
  const name = keeper?.name ?? 'Keeper';
  // Its simulated mood shows in its body (where this chat's mode has one).
  const body = useFeeling(keeper?.id ?? null, assistant.mode);

  // A file dropped on the window (or text dragged in) is held until the next message, which
  // is then about it.
  const handed = useHanded();
  const sendMessage = (text: string) => {
    const held = handed.held;
    handed.clear();
    void assistant.send(text, undefined, held ? { what: held.what, name: held.peek.name } : undefined);
  };

  /** Stop: the microphone, the voice, and the turn in progress (its engine is killed). */
  const stop = () => {
    voice.stop();
    voice.hush();
    if (assistant.busy) void core.cancel().catch(() => undefined);
  };

  /** A poke or a pat on the character: it answers in its own words, out loud. */
  const touched = (kind: Touch) => {
    const now = Date.now();
    if (now - lastTouch.current < TOUCH_GAP_MS || assistant.busy) return;
    lastTouch.current = now;
    if (kind === 'pat') celebrate();
    // The core answers from the keeper's soul and its mood right now (`assistant::touch`).
    void core
      .keeperTouch(kind, { keeper: keeper?.id, mode: assistant.mode || undefined, you: events.personName ?? undefined })
      .then((reply) => {
        body.refresh();
        assistant.announce(reply.line, name);
        voice.speak(reply.line);
      })
      .catch(() => undefined);
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

  /** This chat's mode: the keeper works as that job from the next message on, and says so. */
  const switchMode = (mode: string) => {
    if (!keeper || mode === (assistant.mode || keeper.role)) return;
    assistant.setMode(mode);
    const title = keepers.list?.roles.find((r) => r.id === mode)?.title ?? mode;
    assistant.announce(`Now in ${title} mode.`, name);
  };

  const openChat = (id: string) =>
    chats
      .open(id)
      .then((turns) => {
        assistant.showChat(id, turns);
        stage.fromTurns(turns);
      })
      .catch((e) => assistant.announce(sentence(e), name));

  return (
    <main className={`dashboard ${sidebarOpen ? 'has-panel' : ''} ${stage.showing ? 'has-stage' : ''} ${handed.over ? 'is-dropping' : ''}`}>
      {handed.over && (
        <div className="drop-hint" aria-live="polite">
          <span>Drop it on {name}</span>
        </div>
      )}
      <div className="stage-frame">
        <CharacterStage className="stage" skin={keeper?.skin ?? 'robot'} wearables={worn} look={keeper?.look} habits={keeper?.habits} work={stage.work} mood={mood} feeling={body.feeling} voiceLevel={voice.level} mouth={voice.mouth} memoryPulse={events.pulse} emote={emote} onTouch={(kind) => touched(kind)} />
      </div>
      {stage.showing && (
        <Stage
          panels={stage.panels}
          activity={stage.activity}
          working={assistant.busy}
          keeperName={name}
          scenes={stage.tabs}
          current={stage.current}
          onScene={stage.goTo}
          phase={assistant.phase}
          mind={events.mindLabel(keeper?.brain)}
          onFocus={(f) => assistant.send(focusQuestion(f))}
          onAction={(a) => void actions.act(a)}
          pins={pins}
          onClose={stage.close}
        />
      )}
      {!stage.showing && stage.scenes.length > 0 && (
        <button type="button" className="pill pill-button scenes-pill" onClick={stage.reopen}>
          Scenes · {stage.scenes.length}
        </button>
      )}
      {!stage.showing && stage.scenes.length === 0 && pins.count > 0 && (
        <button type="button" className="pill pill-button scenes-pill" onClick={pins.openLatest}>
          Pinned · {pins.count}
        </button>
      )}
      {events.updated && <UpdateBanner version={events.updated} idle={!assistant.busy && !voice.speaking && !voice.listening} />}
      <TopBar
        assistantName={name}
        node={events.node}
        nodeChecked={events.nodeChecked}
        counts={events.counts}
        alwaysListening={settings.alwaysListening}
        openMic={!settings.wakeWord}
        onMemory={() => setMemoryOpen((o) => !o)}
        onSettings={() => setSettingsOpen(true)}
        onStudio={() => setStudioOpen(true)}
        extra={<FocusChip refreshKey={assistant.exchanges.length} />}
      />
      <KeeperSidebar
        keepers={keepers.list?.keepers ?? []}
        active={keeper}
        roles={keepers.list?.roles ?? []}
        chats={chats.chats}
        chatId={assistant.chatId}
        open={sidebarOpen}
        souls={kit.kit?.souls ?? []}
        onImported={() => { kit.refresh(); keepers.reload(); }}
        error={chats.error ?? keepers.error}
        onToggle={() => setPanelOpen((o) => !o)}
        onActivate={(id) => keepers.activate(id).catch(() => undefined)}
        onNewChat={() => { assistant.newChat(); stage.reset(); }}
        onOpenChat={openChat}
        onDeleteChat={(id) => {
          // Deleting the chat on screen starts a fresh one, so nothing shows erased words.
          if (id === assistant.chatId) { assistant.newChat(); stage.reset(); }
          void chats.remove(id);
        }}
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
        full={sidebarOpen && assistant.chatId !== ''}
        compact={stage.showing}
        onSend={sendMessage}
        tray={<HandedTray held={handed.held} error={handed.error} busy={assistant.busy} keeperName={name} onAsk={sendMessage} onClear={handed.clear} />}
        modeBar={keeper && (
          <ModeBar
            modes={keepers.list?.roles ?? []}
            mode={assistant.mode || keeper.role}
            style={keeper.style ?? 'balanced'}
            onMode={switchMode}
            onStyle={(style) => void changeKeeper({ style })}
          />
        )}
        onMic={voice.listen}
        onStop={stop}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAsk={(t) => void assistant.send(t)}
        commands={paletteCommands({
          keepers: keepers.list?.keepers ?? [],
          activeKeeper: keeper?.id ?? null,
          pinned: pins.list,
          busy: assistant.busy,
          activate: (id) => void keepers.activate(id).catch(() => undefined),
          newChat: () => {
            assistant.newChat();
            stage.reset();
          },
          brief: () => void assistant.send('Brief me'),
          week: () => void assistant.send('Week in review'),
          focus: () => void assistant.send('Start a focus session'),
          clip: (say) => void assistant.send(say),
          stop,
          openSettings: () => setSettingsOpen(true),
          openStudio: () => setStudioOpen(true),
          modes: (keepers.list?.roles ?? []).map((r) => ({ id: r.id, title: r.title })),
          setMode: switchMode,
          openMemory: () => setMemoryOpen(true),
          openScenes: stage.reopen,
          openPinned: pins.open,
        })}
      />
      {keeper && <MemoryDrawer open={memoryOpen} keeper={keeper.id} onClose={() => setMemoryOpen(false)} refreshKey={events.pulse} />}
      {keeper && <StudioPage open={studioOpen} keeper={keeper} soulName={kit.kit?.souls.find((s) => s.id === keeper.soul)?.name ?? keeper.soul} souls={kit.kit?.souls ?? []} onSoul={(soul) => void changeKeeper({ soul })} onClose={() => setStudioOpen(false)} onSaved={() => { kit.refresh(); keepers.reload(); }} />}
      {keeper && (
        <SettingsSheet
          open={settingsOpen}
          settings={settings}
          keeper={keeper}
          kit={kit.kit}
          onKitChanged={() => { kit.refresh(); keepers.reload(); }}
          onOpenStudio={() => { setSettingsOpen(false); setStudioOpen(true); }}
          onClose={() => setSettingsOpen(false)}
          onSaved={setSettings}
          onKeeperChange={changeKeeper}
          onRemoveKeeper={keepers.list && keepers.list.keepers.length > 1 ? () => keepers.remove(keeper.id).then(() => setSettingsOpen(false)) : undefined}
        />
      )}
    </main>
  );
}

