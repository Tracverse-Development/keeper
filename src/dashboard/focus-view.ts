/**
 * The focus timer's words: the time left as a clock ("24:10"). Pure, so it is tested.
 */

/** Minutes and seconds left until `endsAt` (an ISO time); "0:00" once it has passed or is unreadable. */
export function clockLeft(endsAt: string, now: number): string {
  const end = Date.parse(endsAt);
  const seconds = Number.isFinite(end) ? Math.max(0, Math.ceil((end - now) / 1000)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** True once the session's end has passed (the core is about to say so). */
export function isOver(endsAt: string, now: number): boolean {
  const end = Date.parse(endsAt);
  return !Number.isFinite(end) || end <= now;
}
