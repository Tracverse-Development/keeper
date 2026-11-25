/**
 * One conversation with a keeper: send what was said (to that keeper, in the current chat),
 * follow the turn's phases (recalling from the DKG, thinking, acting, remembering) and keep the
 * exchanges on screen. The record lives on the DKG: opening a chat loads its turns from the
 * keeper's graph; a first message starts a new chat there.
 */
import { useEffect, useRef, useState } from 'react';

import { core, EVENTS, on, sentence, type Phase, type Turn, type TurnResult } from '../kernel/ipc';

export interface Exchange {
  id: number;
  said: string;
  result: TurnResult | null;
  error: string | null;
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

  useEffect(
    () =>
      on<{ phase: Phase; detail: string }>(EVENTS.assistantPhase, (p) => {
        setPhase(p.phase);
        setDetail(p.detail ?? '');
      }),
    [],
  );

  // Another keeper is a fresh page; its chats are its own.
  useEffect(() => {
    setExchanges([]);
    setChatId('');
  }, [keeper]);

  /** Run one turn (`call`) shown as `said`; its result goes on screen and to `onReply`. */
  const run = async (said: string, call: () => Promise<TurnResult | null>) => {
    if (busy) return;
    const id = nextId.current++;
    setExchanges((list) => [...list, { id, said, result: null, error: null }].slice(-KEEP));
    setBusy(true);
    try {
      const result = await call();
      if (!result) {
        setExchanges((list) => list.filter((x) => x.id !== id));
        return;
      }
      setChatId(result.chat);
      setExchanges((list) => list.map((x) => (x.id === id ? { ...x, result } : x)));
      replyRef.current(result, said);
    } catch (e) {
      setExchanges((list) => list.map((x) => (x.id === id ? { ...x, error: sentence(e) } : x)));
    } finally {
      setBusy(false);
      setPhase(null);
    }
  };

  /** Send to `toKeeper` (default: the keeper on screen) in the current chat. */
  const send = async (text: string, toKeeper?: string) => {
    const said = text.trim();
    if (!said) return;
    await run(said, () => core.turn(said, toKeeper ?? keeper ?? undefined, chatRef.current || undefined));
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

  /** A whole exchange that happened elsewhere (the phone link). */
  const record = (said: string, result: TurnResult) => {
    const id = nextId.current++;
    setExchanges((list) => [...list, { id, said: `📱 ${said}`, result, error: null }].slice(-KEEP));
  };

  /** Show a chat loaded from the keeper's graph and continue it. */
  const showChat = (chat: string, turns: Turn[]) => {
    setChatId(chat);
    setExchanges(turns.slice(-KEEP).map((t) => fromTurn(nextId.current++, t, keeper ?? '')));
  };

  const newChat = () => {
    setChatId('');
    setExchanges([]);
  };

  return { exchanges, chatId, phase, detail, busy, send, decide, brief, announce, record, showChat, newChat };
}
