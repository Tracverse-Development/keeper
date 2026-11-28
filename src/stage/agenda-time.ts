/**
 * An agenda row's time label, split for its narrow column: the day part ("Tomorrow", "Mon",
 * "4 Dec") on a small line above the clock ("9:00 AM"). Labels with no clock ("All day") are
 * shown whole. Pure; tested in `agenda-time.test.ts`.
 */
export interface AgendaTime {
  day?: string;
  clock: string;
}

const WITH_CLOCK = /^(.*?)\s*(\d{1,2}:\d{2}\s?[AP]M)$/i;

export function agendaTime(label: string): AgendaTime {
  const m = WITH_CLOCK.exec(label.trim());
  if (!m) return { clock: label.trim() };
  return m[1] ? { day: m[1], clock: m[2] } : { clock: m[2] };
}
