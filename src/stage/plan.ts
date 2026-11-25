/**
 * Reading the keeper's plan before it acts (pure; tested in plan.test.ts): which steps are
 * destructive (they lose data, leave the computer, or spend money) and so are drawn in the
 * danger colour on the approval panel.
 */

/** Verbs that cannot be taken back: delete, remove, overwrite, move to trash, send, pay (any form). */
const DESTRUCTIVE = /\b(delet(e|es|ed|ing)|remov(e|es|ed|ing)|overwrit(e|es|ing|ten)|overwrote|trash(es|ed|ing)?|send(s|ing)?|sent|pay(s|ing)?|paid|erase[sd]?|erasing|wipe[sd]?|wiping)\b/i;

/** Whether a plan step's action (or its detail) is destructive: "Delete", "Move to Trash", "Send email". */
export function isDestructive(action: string, detail = ''): boolean {
  return DESTRUCTIVE.test(action) || /\bmove[sd]? to (the )?(trash|bin)\b/i.test(`${action} ${detail}`);
}
