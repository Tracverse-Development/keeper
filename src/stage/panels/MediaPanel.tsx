/**
 * Something to watch, hear or look at, played inside Keeper: a YouTube video in YouTube's
 * privacy-enhanced player, another https video in the video player, a video or song on this
 * computer (through `keeper-media:`, checked by the core), or a picture. Nothing loads or plays
 * until the person presses Play (loading tells that site this computer's address); the app's
 * content policy allows https media, `keeper-media:` and only YouTube's privacy-enhanced player.
 *
 * Under the player: the title, who made it and how long it runs, and the other choices (two
 * alternatives to a found video, or the person's other movies) as buttons that swap it.
 */
import { useState } from 'react';

import { localMediaSrc } from '../../kernel/ipc';
import { urlHost } from '../activity.ts';
import { byline, mediaItems, mediaKind, playingEmbed, type MediaItem } from '../media.ts';
import type { PanelProps } from './panel-props.ts';

/** Where an item plays from, in a few words, for the Play button's note. */
function source(item: MediaItem): string {
  if (item.path) return 'Plays from this Mac';
  if (mediaKind(item) === 'youtube') return "YouTube's privacy-enhanced player";
  return `From ${urlHost(item.url)}`;
}

function Player({ item }: { item: MediaItem }) {
  const [failed, setFailed] = useState(false);
  const kind = mediaKind(item);
  const src = item.path ? localMediaSrc(item.path) : item.url;
  if (failed) {
    const why = item.path ? 'It may have moved, or it is in a format I cannot play.' : 'The site did not send it.';
    return <p className="media-failed">I couldn't play this. {why}</p>;
  }
  const fail = () => setFailed(true);
  if (kind === 'youtube') {
    return <iframe className="media-frame" src={playingEmbed(item.url) ?? undefined} title={item.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" />;
  }
  if (kind === 'video') return <video className="media-frame" src={src} controls autoPlay preload="metadata" onError={fail} />;
  if (kind === 'audio') return <div className="media-audio"><span className="media-audio-note" aria-hidden="true">♪</span><audio src={src} controls autoPlay preload="metadata" onError={fail} /></div>;
  return <img className="media-img" src={src} alt={item.title} loading="lazy" referrerPolicy="no-referrer" onError={fail} />;
}

export function MediaPanel({ panel }: PanelProps<'media'>) {
  const items = mediaItems(panel);
  const [chosen, setChosen] = useState(0);
  const [shown, setShown] = useState(false);
  const item = items[chosen] ?? items[0]!;
  const kind = mediaKind(item);
  const plays = kind !== 'picture';
  const line = byline(item);
  // One video: its maker and length under the player. A list: the chosen row says it.
  const single = items.length === 1;
  const renamed = item.title !== panel.title;
  return (
    <figure className="media">
      {shown ? (
        <Player key={chosen} item={item} />
      ) : (
        <button type="button" className={`media-veil is-${kind}`} onClick={() => setShown(true)}>
          <span className="media-play" aria-hidden="true">{plays ? '▶' : '◎'}</span>
          {!single && renamed && <span className="media-veil-name">{item.title}</span>}
          <span className="media-veil-title">{plays ? 'Play' : 'Show'}{item.length ? ` · ${item.length}` : ''}</span>
          <span className="media-veil-note">{source(item)}</span>
        </button>
      )}
      {(single ? Boolean(line || renamed) : false) || (chosen === 0 && panel.caption) ? (
        <figcaption className="media-caption">
          {single && renamed && <strong className="media-title selectable">{item.title}</strong>}
          {single && line && <span className="muted small">{line}</span>}
          {chosen === 0 && panel.caption && <span className="muted small">{panel.caption}</span>}
        </figcaption>
      ) : null}
      {items.length > 1 && (
        <div className="media-choices" role="group" aria-label={item.path ? 'Your other videos' : 'Other videos'}>
          {items.map((choice, i) => (
            <button key={`${choice.url}${choice.path ?? ''}${i}`} type="button" className={`media-choice${i === chosen ? ' is-chosen' : ''}`} aria-pressed={i === chosen} onClick={() => setChosen(i)}>
              <span className="media-choice-play" aria-hidden="true">{i === chosen ? '●' : '▶'}</span>
              <span className="media-choice-text">
                <span className="media-choice-title">{choice.title}</span>
                {byline(choice) && <span className="muted small">{byline(choice)}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}
