/**
 * One keeper's chats, read from its graph (`desk:Chat` assets, newest first). `refresh` after a
 * turn starts a new chat; `open` loads a chat's turns (oldest first) for the conversation view.
 */
import { useCallback, useEffect, useState } from 'react';

import { core, sentence, type Chat, type Turn } from '../kernel/ipc';

export function useChats(keeper: string | null) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!keeper) return;
    core
      .chats(keeper)
      .then((c) => {
        setChats(c);
        setError(null);
      })
      .catch((e) => setError(sentence(e)));
  }, [keeper]);

  useEffect(() => {
    setChats([]);
    refresh();
  }, [refresh]);

  const open = useCallback((chat: string): Promise<Turn[]> => (keeper ? core.chatTurns(chat, keeper) : Promise.resolve([])), [keeper]);

  return { chats, error, refresh, open };
}
