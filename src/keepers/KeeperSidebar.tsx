/**
 * The left panel: your keepers (each with its own look, domain and graph) and the active
 * keeper's chats, newest first, all read from the DKG. Collapses to a slim rail of keeper
 * badges; a keeper does not need a chat to work, so the panel can stay closed.
 */
import { useState } from 'react';

import type { Chat, DomainInfo, KeeperProfile } from '../kernel/ipc';
import { NewKeeperDialog } from './NewKeeperDialog';
import './keepers.css';

interface Props {
  keepers: KeeperProfile[];
  active: KeeperProfile | null;
  domains: DomainInfo[];
  chats: Chat[];
  chatId: string;
  open: boolean;
  error: string | null;
  onToggle: () => void;
  onActivate: (id: string) => void;
  onNewChat: () => void;
  onOpenChat: (id: string) => void;
  onCreate: (k: { name: string; skin: string; domain: string }) => Promise<unknown>;
}

const SKIN_GLYPH: Record<string, string> = { robot: '🤖', puppy: '🐶' };

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  return d.toDateString() === today.toDateString() ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function KeeperSidebar(p: Props) {
  const [adding, setAdding] = useState(false);
  const domainTitle = (id: string) => p.domains.find((d) => d.id === id)?.title ?? id;

  return (
    <aside className={`keepers glass ${p.open ? 'is-open' : 'is-rail'}`} aria-label="Keepers">
      <div className="keepers-head">
        {p.open && <span className="eyebrow">Your keepers</span>}
        <button type="button" className="btn btn-ghost btn-icon rail-toggle" onClick={p.onToggle} aria-label={p.open ? 'Collapse the keepers panel' : 'Open the keepers panel'}>
          {p.open ? '‹' : '›'}
        </button>
      </div>
      <ul className="keeper-list">
        {p.keepers.map((k) => (
          <li key={k.id}>
            <button type="button" className={`keeper ${p.active?.id === k.id ? 'is-on' : ''}`} onClick={() => p.onActivate(k.id)} title={`${k.name}: ${domainTitle(k.domain)}`}>
              <span className="keeper-badge" aria-hidden>
                {SKIN_GLYPH[k.skin] ?? '✦'}
              </span>
              {p.open && (
                <span className="keeper-words">
                  <strong>{k.name}</strong>
                  <span className="muted small">{domainTitle(k.domain)}</span>
                </span>
              )}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="keeper add" onClick={() => setAdding(true)} title="Add a keeper">
            <span className="keeper-badge" aria-hidden>
              +
            </span>
            {p.open && <span className="keeper-words muted">Add a keeper</span>}
          </button>
        </li>
      </ul>
      {p.open && p.active && (
        <div className="chats">
          <div className="chats-head">
            <span className="eyebrow">Chats with {p.active.name}</span>
            <button type="button" className="link small" onClick={p.onNewChat}>
              New chat
            </button>
          </div>
          {p.error && <p className="error-line small">{p.error}</p>}
          {p.chats.length === 0 && !p.error && <p className="muted small">No chats yet. Say hello.</p>}
          <ul className="chat-list">
            {p.chats.map((c) => (
              <li key={c.id}>
                <button type="button" className={`chat ${c.id === p.chatId ? 'is-on' : ''}`} onClick={() => p.onOpenChat(c.id)}>
                  <span className="chat-title">{c.title || 'Untitled chat'}</span>
                  <span className="muted small">{when(c.at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {adding && <NewKeeperDialog domains={p.domains} onClose={() => setAdding(false)} onCreate={p.onCreate} />}
    </aside>
  );
}
