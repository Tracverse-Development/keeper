/** Media helpers for the Stage (pure; tested by media.test.ts). */

/** The privacy-enhanced embed address for a YouTube link, or null. */
export function youtubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1);
    else if (host === 'youtube.com' && u.pathname === '/watch') id = u.searchParams.get('v');
    else if (host === 'youtube.com' && /^\/(shorts|embed|live)\//.test(u.pathname)) id = u.pathname.split('/')[2] ?? null;
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}
