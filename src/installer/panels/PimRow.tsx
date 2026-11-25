/**
 * The installer's calendar-and-contacts row: the morning brief reads today's events, and the
 * keeper can find a person's number when asked. Read on this Mac only (the voice helper's
 * EventKit/Contacts access), never sent anywhere. macOS shows its own two dialogs.
 */
import { useEffect, useState } from 'react';

import { core, sentence, type PimAccess } from '../../kernel/ipc';
import { pimPermission } from '../steps';
import { PermissionRow } from './PermissionRow';

export function PimRow({ name, onError }: { name: string; onError: (message: string) => void }) {
  const [access, setAccess] = useState<PimAccess | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    core.pimAccess().then(setAccess).catch(() => undefined);
  }, []);

  const allow = async () => {
    setAsking(true);
    try {
      setAccess(await core.pimRequestAccess());
    } catch (e) {
      onError(sentence(e));
    } finally {
      setAsking(false);
    }
  };

  if (access?.calendar === 'unsupported') return null;
  const status = pimPermission(access);
  return (
    <PermissionRow icon="calendar" title="Calendar and contacts" status={status} busy={asking}
      why={`So ${name} can brief you on your day and find someone's number when you ask. Read on this Mac, never sent anywhere.`}
      action={status !== 'allowed' && (
        <button type="button" className="btn permission-btn" onClick={allow} disabled={asking}>Allow calendar and contacts</button>
      )}>
      {status === 'denied' && (
        <p className="permission-note warn-text">To allow them later: System Settings, Privacy & Security, Calendars (Full access) and Contacts, then turn on Keeper.</p>
      )}
    </PermissionRow>
  );
}
