/**
 * One conversation with a keeper: send what was said (to that keeper, in the current chat),
 * follow the turn's phases (recalling from the DKG, thinking, acting, remembering) and keep the
 * exchanges on screen. The record lives on the DKG: opening a chat loads its turns from the
 * keeper's graph; a first message starts a new chat there.
 */
import { useEffect, useRef, useState } from 'react';

import { core, EVENTS, on, sentence, type Handed, type Phase, type Turn, type TurnResult } from '../kernel/ipc';
import { saidWith } from './handed';
import { chatMode } from './styles';

export interface Exchange {
  id: number;
  said: string;
  result: TurnResult | null;
  error: string | null;
  /** The reply's words so far, while the keeper is still writing it (live typing). */
  live?: string;
  /** Sent while the keeper was busy: waiting its turn. */
  queued?: boolean;
  /** A small celebration under the answer (a level up), never in place of it. */
  note?: string;
  /** When the answer arrived (ms): Undo for what it forgot is offered for a while after. */
  at?: number;
}

const KEEP = 40;

/** A stored turn as an on-screen exchange (from a chat loaded off the graph). */
function fromTurn(id: number, t: Turn, keeper: string): Exchange {
  const result: TurnResult = { keeper, chat: t.chat, reply: t.replied, mind: { id: t.mind, label: t.mind || 'reflex', local: true, fellBack: null }, learned: [], forgotten: [], actions: [], panels: [], steps: [], traces: [], writes: [], memoryOffline: false };
  return { id, said: t.said, result, error: null };
}

export function useAssistant(keeper: string | null, onReply: (result: TurnResult, said: string) => void) {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [chatId, setChatId] = useState('');
  const [phase, setPhase] = useState<Phase | null>(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const replyRef = useRef(onReply);
  replyRef.current = onReply;
  const chatRef = useRef(chatId);
  chatRef.current = chatId;
  // The mode this chat is in ('' = the keeper's default mode).
  const [mode, setMode] = useState('');
  const modeRef = useRef(mode);
  modeRef.current = mode;
  /** Moves the chat to a mode. The ref changes at once: a queued message is sent before React
   *  re-renders, and it must go in the new mode (else the keeper announces the switch again). */
  const follow = (to: string) => {
    modeRef.current = to;
    setMode(to);
  };

  useEffect(
    () =>
      on<{ phase: Phase; detail: string }>(EVENTS.assistantPhase, (p) => {
        setPhase(p.phase);
        setDetail(p.detail ?? '');
      }),
    [],
  );

  // The reply arrives word by word: the pending exchange types it live.
  const keeperRef = useRef(keeper);
  keeperRef.current = keeper;
  useEffect(
    () =>
      on<{ keeper: string; text: string }>(EVENTS.replyDelta, (e) => {
        if (e.keeper !== keeperRef.current) return;
        // The exchange being answered: unanswered and not waiting in the queue.
        setExchanges((list) => {
          const i = list.findIndex((x) => !x.result && !x.error && !x.queued);
          if (i < 0) return list;
          return list.map((x, j) => (j === i ? { ...x, live: (x.live ?? '') + e.text } : x));
        });
      }),
    [],
  );

  // The core decided to answer in another mode: the picker follows before the answer is done.
  useEffect(
    () =>
      on<{ keeper: string; mode: string }>(EVENTS.modeSwitched, (e) => {
        if (e.keeper === keeperRef.current && e.mode) follow(e.mode);
      }),
    [],
  );

  // Another keeper is a fresh page; its chats are its own.
  useEffect(() => {
    setExchanges([]);
    setChatId('');
  }, [keeper]);

  // Messages sent while a turn runs wait here and go in order (never dropped).
  const queue = useRef<{ id: number; said: string; call: () => Promise<TurnResult | null> }[]>([]);
  const busyRef = useRef(false);

  /** Run one turn (`call`) for the exchange `id`; then the next queued message, if any. */
  const drive = async (id: number, said: string, call: () => Promise<TurnResult | null>) => {
    busyRef.current = true;
    setBusy(true);
    setExchanges((list) => list.map((x) => (x.id === id ? { ...x, queued: false } : x)));
    try {
      const result = await call();
      if (!result) {
        setExchanges((list) => list.filter((x) => x.id !== id));
      } else {
        setChatId(result.chat);
        // A turn that moved to another mode leaves the chat in that mode (the picker follows).
        if (result.switched && result.mode) follow(result.mode);
        setExchanges((list) => list.map((x) => (x.id === id ? { ...x, result, at: Date.now() } : x)));
        replyRef.current(result, said);
      }
    } catch (e) {
      setExchanges((list) => list.map((x) => (x.id === id ? { ...x, error: sentence(e) } : x)));
    } finally {
      setPhase(null);
      const next = queue.current.shift();
      if (next) {
        void drive(next.id, next.said, next.call);
      } else {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  /** Run one turn (`call`) shown as `said`, now or after the turn in progress. */
  const run = async (said: string, call: () => Promise<TurnResult | null>) => {
    const id = nextId.current++;
    const waiting = busyRef.current;
    setExchanges((list) => [...list, { id, said, result: null, error: null, queued: waiting }].slice(-KEEP));
    if (waiting) {
      queue.current.push({ id, said, call });
      return;
    }
    await drive(id, said, call);
  };

  /** Send to `toKeeper` (default: the keeper on screen) in the current chat. */
  const send = async (text: string, toKeeper?: string, handed?: { what: Handed; name: string }) => {
    const said = text.trim();
    if (!said) return;
    // A message about something handed over (a dropped file) is shown with its name.
    await run(handed ? saidWith(said, handed.name) : said, () => core.turn(said, toKeeper ?? keeper ?? undefined, chatRef.current || undefined, modeRef.current || undefined, handed?.what));
  };

  /** Approve or refuse the plan the keeper showed before acting. */
  const decide = (token: string, approve: boolean) => run(approve ? 'Approved. Go ahead.' : "Don't do it.", () => core.planDecide(token, approve));

  /** The morning brief, once a day (nothing happens when it was already shown today). */
  const brief = () => run('', () => core.briefToday());

  /** Something the keeper said by itself (a reminder, a brain change, a reaction to a touch). */
  const announce = (text: string, label = 'Keeper') => {
    const id = nextId.current++;
    const result: TurnResult = { keeper: keeper ?? '', chat: chatRef.current, reply: text, mind: { id: 'reflex', label, local: true, fellBack: null }, learned: [], forgotten: [], actions: [], panels: [], steps: [], traces: [], writes: [], memoryOffline: false };
    setExchanges((list) => [...list, { id, said: '', result, error: null }].slice(-KEEP));
  };

  /** A celebration under the latest answer (a level up); a new line only if there is no answer yet. */
  const celebrate = (text: string, label = 'Keeper') => {
    setExchanges((list) => {
      const i = list.length - 1;
      if (i < 0 || !list[i].result) {
        const id = nextId.current++;
        const result: TurnResult = { keeper: keeper ?? '', chat: chatRef.current, reply: text, mind: { id: 'reflex', label, local: true, fellBack: null }, learned: [], forgotten: [], actions: [], panels: [], steps: [], traces: [], writes: [], memoryOffline: false };
        return [...list, { id, said: '', result, error: null }].slice(-KEEP);
      }
      return list.map((x, j) => (j === i ? { ...x, note: text } : x));
    });
  };

  /** A whole exchange that happened elsewhere (the phone link). */
  const record = (said: string, result: TurnResult) => {
    const id = nextId.current++;
    setExchanges((list) => [...list, { id, said: `📱 ${said}`, result, error: null }].slice(-KEEP));
  };

  /** Show a chat loaded from the keeper's graph and continue it. */
  const showChat = (chat: string, turns: Turn[]) => {
    setChatId(chat);
    follow(chatMode(turns, ''));
    setExchanges(turns.slice(-KEEP).map((t) => fromTurn(nextId.current++, t, keeper ?? '')));
  };

  const newChat = () => {
    setChatId('');
    setExchanges([]);
    follow('');
  };

  return { exchanges, chatId, mode, setMode: follow, phase, detail, busy, send, decide, brief, announce, celebrate, record, showChat, newChat };
}
