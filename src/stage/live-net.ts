/**
 * The live dashboard's network section in words: what the speeds mean ("Light traffic"), whether
 * this computer is on a network, and amounts a person can read. Pure, so the wording is tested.
 */

/** A speed in kilobytes per second, as people say it. */
export function speedWords(kbps: number): string {
  if (!Number.isFinite(kbps) || kbps < 1) return '0 KB/s';
  return kbps >= 1024 ? `${(kbps / 1024).toFixed(1)} MB/s` : `${Math.round(kbps)} KB/s`;
}

/** An amount in gigabytes ("12.4 GB", "850 MB"). */
export function amountWords(gb: number): string {
  if (!Number.isFinite(gb) || gb <= 0) return '0 MB';
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.max(1, Math.round(gb * 1024))} MB`;
}

export interface NetReading {
  /** One word for how busy it is, and one line saying what that usually means. */
  level: 'offline' | 'quiet' | 'light' | 'busy' | 'heavy';
  title: string;
  meaning: string;
}

/** What the traffic right now means. `address` is this computer's own ('' = on no network). */
export function netReading(downKbps: number, upKbps: number, address: string): NetReading {
  if (!address) return { level: 'offline', title: 'Not on a network', meaning: 'This computer has no network address right now: Wi-Fi may be off or the cable unplugged.' };
  const total = Math.max(0, downKbps) + Math.max(0, upKbps);
  if (total < 50) return { level: 'quiet', title: 'Connected and quiet', meaning: 'Almost nothing is moving: only small background check-ins.' };
  if (total < 1024) return { level: 'light', title: 'Light traffic', meaning: 'Ordinary use: pages, messages and apps syncing.' };
  if (total < 10 * 1024) return { level: 'busy', title: 'Busy', meaning: upKbps > downKbps ? 'Something is sending a lot: an upload, a backup or a call.' : 'Something is bringing a lot in: a download, a video or an update.' };
  return { level: 'heavy', title: 'Heavy traffic', meaning: upKbps > downKbps ? 'A large upload or backup is running.' : 'A large download or update is running.' };
}

/** The highest value of a history (for "peak in the last minute"). */
export function peak(values: readonly number[]): number {
  return values.reduce((m, v) => (Number.isFinite(v) && v > m ? v : m), 0);
}
