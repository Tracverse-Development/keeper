/**
 * The inputs one catalog question takes, one control per parameter: a number of days, an area
 * (fact category), one of this keeper's chats by title, or a skill name. Values stay strings;
 * `questions.ts` says whether they are ready and the core validates them again.
 */
import type { Chat, QuestionParam } from '../kernel/ipc';
import { CATEGORIES, DAYS_MAX, DAYS_MIN } from './questions';

interface Props {
  params: QuestionParam[];
  args: Record<string, string>;
  chats: Chat[];
  onChange: (patch: Record<string, string>) => void;
}

const LABELS: Record<QuestionParam, string> = { days: 'Days back', category: 'Area', chat: 'Chat', skill: 'Skill' };

export function QuestionInputs({ params, args, chats, onChange }: Props) {
  if (params.length === 0) return null;
  return (
    <div className="q-inputs">
      {params.map((p) => {
        const id = `q-param-${p}`;
        return (
          <label key={p} className="q-input" htmlFor={id}>
            <span className="q-label">{LABELS[p]}</span>
            {p === 'days' && (
              <input id={id} className="field q-field" type="number" inputMode="numeric" min={DAYS_MIN} max={DAYS_MAX} step={1}
                value={args.days ?? ''} onChange={(e) => onChange({ days: e.target.value })} />
            )}
            {p === 'category' && (
              <select id={id} className="field q-field" value={args.category ?? ''} onChange={(e) => onChange({ category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            {p === 'chat' && (
              <select id={id} className="field q-field" value={args.chat ?? ''} disabled={chats.length === 0} onChange={(e) => onChange({ chat: e.target.value })}>
                {chats.length === 0 && <option value="">No chats yet</option>}
                {chats.map((c) => (
                  <option key={c.id} value={c.id}>{c.title || 'Untitled chat'}</option>
                ))}
              </select>
            )}
            {p === 'skill' && (
              <input id={id} className="field q-field" value={args.skill ?? ''} maxLength={40} placeholder="open-app, agent:Bash…"
                autoCorrect="off" autoCapitalize="off" spellCheck={false} onChange={(e) => onChange({ skill: e.target.value })} />
            )}
          </label>
        );
      })}
    </div>
  );
}
