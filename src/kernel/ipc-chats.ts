/**
 * A keeper's chats as the core sends them (`memory::records::Chat`, `memory::chats::Found`).
 */

export interface Chat {
  id: string;
  title: string;
  at: string;
  /** Kept at the top of the list (absent: not pinned). */
  pinned?: boolean;
}

/** One chat a search found, with the line that matched (`memory::chats::Found`). */
export interface ChatFound {
  chat: string;
  title: string;
  snippet: string;
  at: string;
}
