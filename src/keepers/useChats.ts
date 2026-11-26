/**
 * One keeper's chats, read from its graph (`desk:Chat` assets, newest first). `refresh` after a
 * turn starts a new chat; `open` loads a chat's turns (oldest first) for the conversation view.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { core, sentence, type Chat, type Turn } from '../kernel/ipc';

export function useChats(keeper: string | null) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [error, setError] = useState<string | null>(null);

  // The keeper on screen now: a list that arrives for one switched away from is dropped.
  const current = useRef(keeper);
  current.current = keeper;

  const refresh = useCallback(() => {
    if (!keeper) return;
    core
      .chats(keeper)
      .then((c) => {
        if (current.current !== keeper) return;
        setChats(c);
        setError(null);
      })
      .catch((e) => current.current === keeper && setError(sentence(e)));
  }, [keeper]);

  useEffect(() => {
    setChats([]);
    refresh();
  }, [refresh]);

  /** Erase a chat from the graph, then re-read the list (a failure is shown, never swallowed). */
  const remove = useCallback(
    async (chat: string) => {
      if (!keeper) return;
      try {
        await core.deleteChat(chat, keeper);
        setChats((list) => list.filter((c) => c.id !== chat));
        setError(null);
      } catch (e) {
        setError(sentence(e));
      }
      refresh();
    },
    [keeper, refresh],
  );

  /** Rename and/or pin a chat, then re-read the list. */
  const change = useCallback(
    async (chat: string, what: { title?: string; pinned?: boolean }) => {
      if (!keeper) return;
      try {
        const saved = await core.chatChange(chat, what, keeper);
        setChats((list) => list.map((c) => (c.id === chat ? saved : c)));
        setError(null);
      } catch (e) {
        setError(sentence(e));
      }
    },
    [keeper],
  );

  const open = useCallback((chat: string): Promise<Turn[]> => (keeper ? core.chatTurns(chat, keeper) : Promise.resolve([])), [keeper]);

  return { chats, error, refresh, open, remove, change };
}
