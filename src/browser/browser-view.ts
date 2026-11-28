/** The browser's words, pure (tested by `browser-view.test.ts`). */

/** "https://mail.google.com/mail/u/0/" → "mail.google.com"; anything unreadable → "". */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}
