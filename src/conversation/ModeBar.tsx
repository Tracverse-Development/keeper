/**
 * The mode and style of the conversation, by the message box: the MODE is the job for this chat
 * (Assistant, System Administrator, Researcher…; each with its own skills and tools), the STYLE is
 * how answers are shown (Balanced, Explainer, Brief, Chat) and belongs to the keeper.
 */
import type { RoleInfo } from '../kernel/ipc';
import { STYLES } from './styles';

interface Props {
  modes: RoleInfo[];
  mode: string;
  style: string;
  onMode: (mode: string) => void;
  onStyle: (style: string) => void;
}

const TOOL_WORDS: Record<RoleInfo['tools'], string> = { none: 'talk only', web: 'searches the web', look: 'can look at your computer', act: 'can change your computer' };

export function ModeBar({ modes, mode, style, onMode, onStyle }: Props) {
  const current = modes.find((m) => m.id === mode);
  return (
    <div className="mode-bar">
      <label className="mode-pick" title={current ? `${current.blurb} (${TOOL_WORDS[current.tools]})` : undefined}>
        <span className="mode-label">Mode</span>
        <select value={mode} onChange={(e) => onMode(e.target.value)} aria-label="Mode for this chat">
          {modes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </label>
      <label className="mode-pick">
        <span className="mode-label">Style</span>
        <select value={style || 'balanced'} onChange={(e) => onStyle(e.target.value)} aria-label="How answers are shown">
          {STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
