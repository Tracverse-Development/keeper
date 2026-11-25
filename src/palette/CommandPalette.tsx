/**
 * The command palette (⌘K / Ctrl+K): type to find a command (switch keeper, new chat, brief,
 * a pinned scene, settings…), ↑/↓ to choose, Enter to run, Esc to close. Words that match no
 * command are sent to the keeper as a message ("Ask: …"), so the palette is also the fastest
 * way to talk. The commands are supplied by the dashboard; ranking is `rank`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { rank, type Command } from './rank';
import './palette.css';

interface Props {
  open: boolean;
  commands: Command[];
  onAsk: (text: string) => void;
  onClose: () => void;
}

export function CommandPalette({ open, commands, onAsk, onClose }: Props) {
  const [typed, setTyped] = useState('');
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTyped('');
      setAt(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  const shown = useMemo(() => {
    const found = rank(commands, typed);
    const ask: Command[] = typed.trim() ? [{ id: 'ask', title: `Ask: ${typed.trim()}`, hint: 'Send it to your keeper', run: () => onAsk(typed.trim()) }] : [];
    return found.length ? [...found, ...ask] : ask;
  }, [commands, typed, onAsk]);

  if (!open) return null;
  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAt((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAt((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(shown[at]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="palette-veil" onMouseDown={onClose}>
      <div className="palette glass" role="dialog" aria-label="Commands" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={input}
          className="palette-input"
          value={typed}
          placeholder="Type a command, or anything to ask…"
          aria-label="Command"
          onChange={(e) => {
            setTyped(e.target.value);
            setAt(0);
          }}
          onKeyDown={onKey}
        />
        <ul className="palette-list" role="listbox">
          {shown.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === at}>
              <button type="button" className={`palette-item ${i === at ? 'is-on' : ''}`} onMouseEnter={() => setAt(i)} onClick={() => run(c)}>
                <span className="palette-title">{c.title}</span>
                {c.hint && <span className="palette-hint">{c.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
        <p className="palette-keys">↑↓ choose · Enter run · Esc close</p>
      </div>
    </div>
  );
}
