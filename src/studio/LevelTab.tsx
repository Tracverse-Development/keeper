/** Level: experience earned by use (read from the keeper's own graph) and what each level opens. */
import type { StudioInfo } from '../kernel/ipc-studio';
import { levelProgress } from './studio-view';

export function LevelTab({ info, name }: { info: StudioInfo; name: string }) {
  const e = info.experience;
  return (
    <div className="studio-tab">
      <div className="studio-level">
        <span className="studio-level-num">{Math.max(1, e.level)}</span>
        <div className="studio-level-body">
          <strong>Level {Math.max(1, e.level)}</strong>
          <div className="studio-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(levelProgress(e) * 100)}>
            <span style={{ width: `${levelProgress(e) * 100}%` }} />
          </div>
          <span className="muted small">
            {e.xp} XP · {Math.max(0, e.nextXp - e.xp)} to level {e.level + 1}
          </span>
        </div>
      </div>
      <p className="muted small">
        {name} grows by being used: {e.done.turns} messages, {e.done.lessons} lessons, {e.done.quizRight} quiz answers right, {e.done.actions} things done on your computer. Counted from its own memory graph, so nobody can buy or edit a level.
      </p>
      <ol className="studio-unlocks">
        {info.unlocks.map((u) => {
          const open = e.level >= u.level;
          return (
            <li key={u.id} className={open ? 'is-open' : ''}>
              <span className="studio-unlock-level">Level {u.level}</span>
              <span>{u.name}</span>
              <span className="muted small">{open ? 'Unlocked' : 'Locked'}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
