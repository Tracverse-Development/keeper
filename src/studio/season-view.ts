/**
 * The season shelf's rules and words (`keepers::season_commands`): how a quest's progress
 * reads, what its button says, and how long the season is still open. Pure, so it is tested.
 */
import type { SeasonQuest } from '../kernel/ipc-studio';

/** "Finish 3 focus sessions · 1 of 3", or that it is done. */
export function questLine(q: Pick<SeasonQuest, 'quest' | 'done' | 'goal' | 'earned' | 'claimed'>): string {
  if (q.claimed) return 'Yours to keep.';
  if (q.earned) return `${q.quest}: done.`;
  return `${q.quest} · ${q.done} of ${q.goal}`;
}

/** The button under a season item: what it says and whether it can be pressed. */
export function questAction(q: Pick<SeasonQuest, 'earned' | 'claimed'>): { label: string; can: boolean } {
  if (q.claimed) return { label: 'In your inventory', can: false };
  return q.earned ? { label: 'Claim', can: true } : { label: 'Not earned yet', can: false };
}

/** "Open for 12 more days", "Last day today". */
export function daysLeftWords(daysLeft: number): string {
  if (daysLeft <= 1) return 'Last day today';
  return `Open for ${daysLeft - 1} more ${daysLeft - 1 === 1 ? 'day' : 'days'}`;
}

/** How far a quest is, 0..1 (for its bar). */
export function questProgress(q: Pick<SeasonQuest, 'done' | 'goal'>): number {
  return q.goal > 0 ? Math.min(Math.max(q.done / q.goal, 0), 1) : 0;
}
