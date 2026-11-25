/**
 * The Stage's line icons, drawn inline (CSP `default-src 'self'`: no icon fonts, no images).
 * One 24-unit stroke set; colour comes from `currentColor`, so CSS tokens tint them.
 */
import type { ReactNode } from 'react';

export type IconName =
  | 'run' | 'edit' | 'read' | 'search' | 'web' | 'work'
  | 'open' | 'create' | 'move' | 'delete' | 'find'
  | 'close' | 'file' | 'next' | 'back' | 'check' | 'cross' | 'ask'
  | 'folder' | 'event' | 'reminder' | 'task' | 'pin' | 'forget' | 'sparkle' | 'shield';

const PATHS: Record<IconName, ReactNode> = {
  run: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m7 9 3 3-3 3M12.5 15H17" /></>,
  edit: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  read: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  web: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.7 3.8 5.7 3.8 9s-1.2 6.3-3.8 9c-2.6-2.7-3.8-5.7-3.8-9S9.4 5.7 12 3Z" /></>,
  work: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></>,
  open: <><path d="M3 7.5V18a1.5 1.5 0 0 0 1.5 1.5h13.2a1.5 1.5 0 0 0 1.4-1l2.4-6.5H7.2a1.5 1.5 0 0 0-1.4 1L3 19" /><path d="M3 7.5V6a1.5 1.5 0 0 1 1.5-1.5h4l2 2h6A1.5 1.5 0 0 1 18 8v4" /></>,
  create: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 11v6M9 14h6" /></>,
  move: <><path d="M4 12h15M14 6l6 6-6 6" /></>,
  delete: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></>,
  find: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m19.5 19.5-5-5M8.5 10.5h4" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  next: <><path d="m9 6 6 6-6 6" /></>,
  back: <><path d="m15 6-6 6 6 6" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  cross: <><path d="M7 7l10 10M17 7 7 17" /></>,
  ask: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" /><path d="M10 8.5a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v.4M12 13.6v.1" /></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  event: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  reminder: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  task: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  pin: <><path d="M9 3.5h6l-1 5 3 3v2H7v-2l3-3z" /><path d="M12 13.5V21" /></>,
  forget: <><path d="M4 7h16M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /><path d="m10 11 4 5M14 11l-4 5" /></>,
  sparkle: <><path d="M12 3c.7 4.7 2.3 6.3 7 7-4.7.7-6.3 2.3-7 7-.7-4.7-2.3-6.3-7-7 4.7-.7 6.3-2.3 7-7Z" /><path d="M19 3.5v3M17.5 5h3" /></>,
  shield: <><path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="stage-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
