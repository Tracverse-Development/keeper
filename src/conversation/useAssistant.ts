/**
 * One conversation with the assistant: send what was said, follow the turn's phases
 * (recalling from the DKG, thinking, acting, remembering) and keep the recent exchanges.
 * The exchanges shown here are only the window's view; the record lives on the DKG.
 */
import { useEffect, useRef, useState } from 'react';

import { core, EVENTS, on, sentence, type Phase, type TurnResult } from '../kernel/ipc';

export interface Exchange {
  id: number;
  said: string;
  result: TurnResult | null;
  error: string | null;
}

const KEEP = 12;

export function useAssistant(onReply: (result: TurnResult) => void) {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const replyRef = useRef(onReply);
  replyRef.current = onReply;

  const [detail, setDetail] = useState('');
  useEffect(
    () =>
      on<{ phase: Phase; detail: string }>(EVENTS.assistantPhase, (p) => {
        setPhase(p.phase);
        setDetail(p.detail ?? '');
      }),
    [],
  );

  const send = async (text: string) => {
    const said = text.trim();
    if (!said || busy) return;
    const id = nextId.current++;
    setExchanges((list) => [...list, { id, said, result: null, error: null }].slice(-KEEP));
    setBusy(true);
    try {
      const result = await core.turn(said);
      setExchanges((list) => list.map((x) => (x.id === id ? { ...x, result } : x)));
      replyRef.current(result);
    } catch (e) {
      setExchanges((list) => list.map((x) => (x.id === id ? { ...x, error: sentence(e) } : x)));
    } finally {
      setBusy(false);
      setPhase(null);
    }
  };

  /** Something the assistant said by itself (a reminder, a brain change, a reaction to a touch). */
  const announce = (text: string, label = 'Keeper') => {
    const id = nextId.current++;
    const result: TurnResult = { reply: text, mind: { id: 'reflex', label, local: true, fellBack: null }, learned: [], forgotten: [], actions: [], steps: [], traces: [], writes: [], memoryOffline: false };
    setExchanges((list) => [...list, { id, said: '', result, error: null }].slice(-KEEP));
  };

  /** A whole exchange that happened elsewhere (the phone link). */
  const record = (said: string, result: TurnResult) => {
    const id = nextId.current++;
    setExchanges((list) => [...list, { id, said: `📱 ${said}`, result, error: null }].slice(-KEEP));
  };

  return { exchanges, phase, detail, busy, send, announce, record };
}
