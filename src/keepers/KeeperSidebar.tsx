/**
 * The left panel: your keepers (each with its own look, domain and graph) and the active
 * keeper's chats, newest first, all read from the DKG. Collapses to a slim rail of keeper
 * badges; a keeper does not need a chat to work, so the panel can stay closed.
 */
import { ChatList } from './ChatList';
import { useState } from 'react';

import type { Chat, KeeperProfile, RoleInfo, Soul } from '../kernel/ipc';
import { NewKeeperDialog } from './NewKeeperDialog';
import './keepers.css';

interface Props {
  keepers: KeeperProfile[];
  active: KeeperProfile | null;
  roles: RoleInfo[];
  souls: Soul[];
  /** A keeper pack was imported (refresh the lists). */
  onImported: () => void;
  chats: Chat[];
  chatId: string;
  open: boolean;
  error: string | null;
  onToggle: () => void;
  onActivate: (id: string) => void;
  onNewChat: () => void;
  onOpenChat: (id: string) => void;
  /** Erase a chat from the keeper's graph (asked twice: Delete, then Delete for good). */
  onDeleteChat: (id: string) => void;
  /** Rename and/or pin a chat. */
  onChangeChat: (id: string, change: { title?: string; pinned?: boolean }) => void;
  onCreate: (k: { name: string; skin: string; role: string; soul?: string }) => Promise<unknown>;
}

const SKIN_GLYPH: Record<string, string> = { robot: '🤖', puppy: '🐶' };

export function KeeperSidebar(p: Props) {
  const [adding, setAdding] = useState(false);
  const roleTitle = (id: string) => p.roles.find((r) => r.id === id)?.title ?? id;

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
            <button type="button" className={`keeper ${p.active?.id === k.id ? 'is-on' : ''}`} onClick={() => p.onActivate(k.id)} title={`${k.name}: ${roleTitle(k.role)}`}>
              <span className="keeper-badge" aria-hidden>
                {SKIN_GLYPH[k.skin] ?? '✦'}
              </span>
              {p.open && (
                <span className="keeper-words">
                  <strong>{k.name}</strong>
                  <span className="muted small">{roleTitle(k.role)}</span>
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
      {p.open && p.active && <ChatList keeper={p.active.id} keeperName={p.active.name} chats={p.chats} chatId={p.chatId} error={p.error} onNew={p.onNewChat} onOpen={p.onOpenChat} onDelete={p.onDeleteChat} onChange={p.onChangeChat} />}
      {adding && <NewKeeperDialog roles={p.roles} souls={p.souls} onClose={() => setAdding(false)} onCreate={p.onCreate} onImported={p.onImported} />}
    </aside>
  );
}
