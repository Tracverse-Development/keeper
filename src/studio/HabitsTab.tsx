/** Habits: what this keeper does on its own when idle, from never to all the time. */
import type { StudioInfo } from '../kernel/ipc-studio';
import { habitWeight, habitWords } from './studio-view';

interface Props {
  info: StudioInfo;
  name: string;
  habits: Record<string, number>;
  onHabits: (habits: Record<string, number>) => void;
}

export function HabitsTab({ info, name, habits, onHabits }: Props) {
  return (
    <div className="studio-tab">
      <p className="muted small">What {name} does on its own while you are away. These are {name}'s own: each keeper has its habits.</p>
      <ul className="studio-habits">
        {info.habits.map((h) => {
          const w = habitWeight(habits, h.id);
          return (
            <li key={h.id}>
              <label htmlFor={`habit-${h.id}`}>{h.name}</label>
              <input id={`habit-${h.id}`} type="range" min={0} max={info.maxHabit} step={0.5} value={w} onChange={(e) => onHabits({ ...habits, [h.id]: Number(e.target.value) })} />
              <span className="muted small">{habitWords(w)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
