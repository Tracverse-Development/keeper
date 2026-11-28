/** Media helpers for the Stage (pure; tested by media.test.ts). */
import type { MediaChoice, Panel } from './panel-spec.ts';

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

/** One thing a media panel can play: its main video or one of its choices. */
export type MediaItem = MediaChoice;

/** What plays it: YouTube's player, the video player, the audio player, or a picture. */
export type MediaKind = 'youtube' | 'video' | 'audio' | 'picture';

/** A file's name without its folder ("Trip 2025.mp4"). */
export function fileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/**
 * Everything a media panel offers, its own video first, then its choices. A file on this
 * computer is named by its file name (the panel's title may name the whole list).
 */
export function mediaItems(panel: Extract<Panel, { kind: 'media' }>): MediaItem[] {
  const main: MediaItem = { title: panel.path ? fileName(panel.path) : panel.title, url: panel.url, path: panel.path, channel: panel.channel, length: panel.length };
  return [main, ...(panel.choices ?? [])];
}

const VIDEO_FILE = /\.(mp4|m4v|mov|webm)$/i;
const AUDIO_FILE = /\.(mp3|m4a|aac|wav|aif|aiff|flac)$/i;

/** How an item plays (a local file by its extension; a web address by its site or extension). */
export function mediaKind(item: MediaItem): MediaKind {
  if (item.path) return AUDIO_FILE.test(item.path) ? 'audio' : 'video';
  if (youtubeEmbed(item.url)) return 'youtube';
  const path = item.url.split(/[?#]/)[0] ?? '';
  if (VIDEO_FILE.test(path)) return 'video';
  if (AUDIO_FILE.test(path)) return 'audio';
  return 'picture';
}

/** Who made it and how long it runs, in one line ("Howcast · 1:24"); empty when neither is known. */
export function byline(item: MediaItem): string {
  return [item.channel, item.length].filter((s): s is string => Boolean(s && s.trim())).join(' · ');
}

/**
 * The player page to load once the person pressed Play: Keeper's own loopback page
 * (`player` = `http://127.0.0.1:<port>`, from the core's `stage::player`), which embeds YouTube's
 * privacy-enhanced player. YouTube refuses to play inside the app's own address (Error 153).
 */
export function playingEmbed(url: string, player: string): string | null {
  const embed = youtubeEmbed(url);
  const id = embed?.split('/embed/')[1];
  return id && /^http:\/\/127\.0\.0\.1:\d+$/.test(player) ? `${player}/youtube/${id}` : null;
}
