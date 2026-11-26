/**
 * One keeper's chats in the sidebar: pinned ones first, a search across every conversation
 * (the words you remember; each result shows the line that matched), and on each chat: pin,
 * rename (the pencil, then Enter) and delete (asked twice). Everything is read from and written
 * to the keeper's graph.
 */
import { useEffect, useState } from 'react';

import { core, sentence, type Chat, type ChatFound } from '../kernel/ipc';
import { ordered, searchable } from './chat-list-view';

interface Props {
  keeper: string;
  keeperName: string;
  chats: Chat[];
  chatId: string;
  error: string | null;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  /** Rename and/or pin a chat (left out = unchanged). */
  onChange: (id: string, change: { title?: string; pinned?: boolean }) => void;
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ChatList(p: Props) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<ChatFound[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  /** The chat whose Delete was pressed once (a second press erases it), and the one being renamed. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);

  // The search runs a moment after typing stops; an answer for older words is dropped.
  useEffect(() => {
    setSearchError(null);
    if (!searchable(query)) {
      setFound(null);
      return;
    }
    let current = true;
    const timer = window.setTimeout(() => {
      core
        .chatsSearch(query, p.keeper)
        .then((f) => current && setFound(f))
        .catch((e) => current && setSearchError(sentence(e)));
    }, 250);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [query, p.keeper]);

  const rename = () => {
    if (renaming && renaming.title.trim()) p.onChange(renaming.id, { title: renaming.title });
    setRenaming(null);
  };

  return (
    <div className="chats">
      <div className="chats-head">
        <span className="eyebrow">Chats with {p.keeperName}</span>
        <button type="button" className="link small" onClick={p.onNew}>
          New chat
        </button>
      </div>
      <input className="field field-small chat-search" type="search" placeholder="Search your chats" aria-label="Search your chats" value={query} onChange={(e) => setQuery(e.target.value)} />
      {(p.error || searchError) && <p className="error-line small">{p.error ?? searchError}</p>}
      {found ? (
        <ul className="chat-list" aria-label="Search results">
          {found.length === 0 && <li className="muted small">No chat holds those words.</li>}
          {found.map((f) => (
            <li key={f.chat} className="chat-row">
              <button type="button" className={`chat ${f.chat === p.chatId ? 'is-on' : ''}`} onClick={() => p.onOpen(f.chat)}>
                <span className="chat-title">{f.title || 'Untitled chat'}</span>
                <span className="muted small chat-snippet">{f.snippet}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          {p.chats.length === 0 && !p.error && <p className="muted small">No chats yet. Say hello.</p>}
          <ul className="chat-list">
            {ordered(p.chats).map((c) => {
              const title = c.title || 'Untitled chat';
              return (
                <li key={c.id} className={`chat-row ${c.pinned ? 'is-pinned' : ''}`}>
                  {renaming?.id === c.id ? (
                    <input
                      className="field field-small"
                      autoFocus
                      aria-label={`New name for ${title}`}
                      maxLength={60}
                      value={renaming.title}
                      onChange={(e) => setRenaming({ id: c.id, title: e.target.value })}
                      onBlur={rename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') rename();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                    />
                  ) : (
                    <button type="button" className={`chat ${c.id === p.chatId ? 'is-on' : ''}`} onClick={() => p.onOpen(c.id)}>
                      <span className="chat-title">
                        {c.pinned && <span className="chat-pin-mark" aria-hidden>★ </span>}
                        {title}
                      </span>
                      <span className="muted small">{when(c.at)}</span>
                    </button>
                  )}
                  {renaming?.id !== c.id && (
                    <span className={`chat-tools ${confirming === c.id ? 'is-confirming' : ''}`}>
                      <button type="button" aria-label={c.pinned ? `Unpin ${title}` : `Pin ${title} to the top`} aria-pressed={Boolean(c.pinned)} onClick={() => p.onChange(c.id, { pinned: !c.pinned })}>
                        {c.pinned ? '★' : '☆'}
                      </button>
                      <button type="button" aria-label={`Rename ${title}`} onClick={() => setRenaming({ id: c.id, title: c.title })}>
                        ✎
                      </button>
                      <button
                        type="button"
                        className="chat-delete"
                        aria-label={confirming === c.id ? `Delete "${title}" for good` : `Delete "${title}"`}
                        onClick={() => {
                          if (confirming === c.id) {
                            setConfirming(null);
                            p.onDelete(c.id);
                          } else setConfirming(c.id);
                        }}
                        onBlur={() => setConfirming((x) => (x === c.id ? null : x))}
                      >
                        {confirming === c.id ? 'Delete for good' : '×'}
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
