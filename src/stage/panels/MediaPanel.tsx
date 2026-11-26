/**
 * Something to watch or look at: a YouTube video plays in place (privacy-enhanced embed); other
 * https videos play in a player; anything else shows as a picture. Nothing loads until the person
 * presses Play or Show: loading tells that site this computer's address (the app's content policy
 * allows https pictures and videos and only YouTube's privacy-enhanced player).
 */
import { useState } from 'react';

import { urlHost } from '../activity.ts';
import { youtubeEmbed } from '../media.ts';
import type { PanelProps } from './panel-props.ts';

export function MediaPanel({ panel }: PanelProps<'media'>) {
  const [shown, setShown] = useState(false);
  const embed = youtubeEmbed(panel.url);
  const video = !embed && /\.(mp4|webm|mov)(\?|$)/i.test(panel.url);
  return (
    <figure className="media">
      {!shown ? (
        <button type="button" className="media-veil" onClick={() => setShown(true)}>
          <span className="media-play" aria-hidden="true">{embed || video ? '▶' : '◎'}</span>
          <span>{embed || video ? 'Play' : 'Show'} from {urlHost(panel.url)}</span>
        </button>
      ) : embed ? (
        <iframe className="media-frame" src={embed} title={panel.title} allow="encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" />
      ) : video ? (
        <video className="media-frame" src={panel.url} controls preload="metadata" />
      ) : (
        <img className="media-img" src={panel.url} alt={panel.caption ?? panel.title} loading="lazy" referrerPolicy="no-referrer" />
      )}
      {panel.caption && <figcaption className="muted small">{panel.caption}</figcaption>}
    </figure>
  );
}
