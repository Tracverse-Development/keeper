/**
 * One row of the installer's permission checklist: an icon, what the permission is for, where
 * it stands (waiting / allowed / not allowed) and its action. `children` carries the row's own
 * detail (each folder's result, the shortcut, what to do in System Settings).
 */
import type { ReactNode } from 'react';

import { PERMISSION_WORDS, type PermissionStatus } from '../steps';

export type PermissionIcon = 'mic' | 'folder' | 'key';

const PATHS: Record<PermissionIcon, ReactNode> = {
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </>
  ),
  folder: <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
  key: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M8 14h8" />
    </>
  ),
};

interface Props {
  icon: PermissionIcon;
  title: string;
  why: string;
  status: PermissionStatus;
  busy?: boolean;
  action?: ReactNode;
  children?: ReactNode;
}

export function PermissionRow({ icon, title, why, status, busy = false, action, children }: Props) {
  return (
    <li className={`permission is-${status}`}>
      <span className="permission-icon" aria-hidden>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {PATHS[icon]}
        </svg>
      </span>
      <div className="permission-body">
        <div className="permission-head">
          <strong>{title}</strong>
          <span className={`permission-status is-${status}`}>
            {busy ? <span className="spinner" /> : <span className={`dot ${status === 'allowed' ? 'ok' : status === 'denied' ? 'warn' : ''}`} />}
            {busy ? 'Asking…' : PERMISSION_WORDS[status]}
          </span>
        </div>
        <p className="permission-why">{why}</p>
        {children}
        {action && <div className="permission-action">{action}</div>}
      </div>
    </li>
  );
}
