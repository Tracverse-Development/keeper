/**
 * The one line shown about where a pack comes from, from its checked signature. Pure, so it is
 * tested.
 */
import type { PackTrust } from '../kernel/ipc-studio';

export interface TrustLine {
  words: string;
  /** warn: think before adding; bad: it will be refused. */
  tone: 'ok' | 'plain' | 'warn' | 'bad';
}

export function trustLine(t: PackTrust): TrustLine {
  if (t.signature.state === 'broken') return { words: 'Its signature does not match: it was changed after it was made. It cannot be added.', tone: 'bad' };
  if (t.otherKeyForName) return { words: `Careful: it says it is by ${t.maker}, but it is not signed by the ${t.maker} whose packs you added before.`, tone: 'warn' };
  if (t.signature.state === 'unsigned') return { words: 'Not signed, so who made it cannot be checked.', tone: 'plain' };
  const fp = t.signature.fingerprint;
  if (t.seenBefore) return { words: `Signed by the same maker as packs you added before (key ${fp}).`, tone: 'ok' };
  return { words: `Signed and unchanged since it was made (key ${fp}). This is the first pack from this key.`, tone: 'plain' };
}
