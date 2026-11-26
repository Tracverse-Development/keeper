/**
 * The backup section's rules and words: when a passphrase may be used, and what to say after a
 * backup was saved or brought in. Pure, so they are tested.
 */

/** The shortest passphrase the core takes (`backup::seal::MIN_PASSPHRASE`). */
export const MIN_PASSPHRASE = 8;

/** Why this passphrase cannot be used yet, or null when it can. `again` = typed a second time (saving only). */
export function passphraseProblem(passphrase: string, again?: string): string | null {
  if ([...passphrase].length < MIN_PASSPHRASE) return `Use at least ${MIN_PASSPHRASE} characters.`;
  if (again !== undefined && passphrase !== again) return 'The two passphrases are not the same.';
  return null;
}

const count = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

export function savedWords(saved: { keepers: number; records: number }): string {
  return `Saved ${count(saved.keepers, 'keeper', 'keepers')} and ${count(saved.records, 'record', 'records')} to your Downloads folder. Without the passphrase nobody can open it, including you.`;
}

export function restoredWords(r: { keepers: string[]; written: number; already: number }): string {
  const who = r.keepers.length === 1 ? r.keepers[0] : `${r.keepers.slice(0, -1).join(', ')} and ${r.keepers[r.keepers.length - 1]}`;
  const here = r.already > 0 ? ` ${count(r.already, 'record was', 'records were')} already here and left as they were.` : '';
  return `Brought in ${who}: ${count(r.written, 'record', 'records')} written.${here}`;
}

/** A file's bytes as base64 (what the core's restore takes), built in chunks so a large file does not overflow the call stack. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
