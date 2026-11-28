/** The top bar: brand, the memory node's health, and the memory and settings buttons. */
import type { Counts, NodeStatus } from '../kernel/ipc';
import { Mark } from '../kernel/Mark';

interface Props {
  assistantName: string;
  node: NodeStatus | null;
  nodeChecked: boolean;
  counts: Counts | null;
  alwaysListening: boolean;
  openMic: boolean;
  onMemory: () => void;
  onSettings: () => void;
  /** Open the Studio (make this keeper your own). */
  onStudio: () => void;
  /** Shown first on the right (the focus timer while a session runs). */
  extra?: React.ReactNode;
}

export function TopBar(p: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <Mark size={26} />
        <span>
          {p.assistantName}
          {p.assistantName.trim().toLowerCase() !== 'keeper' && <em> · Keeper</em>}
        </span>
      </div>
      <div className="topbar-right">
        {p.extra}
        {p.alwaysListening && (
          <span className="pill">
            <span className="dot ok" /> {p.openMic ? 'Open mic: listening' : `Listening for “${p.assistantName}”`}
          </span>
        )}
        <button type="button" className="pill pill-button node-pill" onClick={p.onSettings} title={p.node ? `${p.node.name} · ${p.node.networkName}. Press to check everything.` : 'Press to see what is wrong.'}>
          <span className={`dot ${p.node ? 'ok' : p.nodeChecked ? 'off' : ''}`} />
          {p.node ? <>DKG node {p.node.version}<span className="node-pill-more"> · working memory</span></> : p.nodeChecked ? 'Memory node offline' : 'Checking memory node…'}
        </button>
        <button type="button" className="pill pill-button" onClick={p.onMemory}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
            <circle cx="6" cy="7" r="2.2" fill="currentColor" />
            <circle cx="18" cy="6" r="2.2" fill="currentColor" />
            <circle cx="12" cy="17" r="2.2" fill="currentColor" />
            <path d="M6 7 18 6 12 17Z" fill="none" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          Memory{p.counts ? ` · ${p.counts.facts}` : ''}
        </button>
        <button type="button" className="pill pill-button" onClick={p.onStudio}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
            <path fill="currentColor" d="M12 2.5 14.6 8l6 .9-4.3 4.2 1 6-5.3-2.8L6.7 19.1l1-6L3.4 8.9l6-.9Z" />
          </svg>
          Studio
        </button>
        <button type="button" className="pill pill-button" onClick={p.onSettings} aria-label="Settings">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
            <path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" transform="translate(-1 0)" />
          </svg>
        </button>
      </div>
    </header>
  );
}
