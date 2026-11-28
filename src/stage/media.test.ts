import assert from 'node:assert/strict';
import { test } from 'node:test';

import { byline, fileName, mediaItems, mediaKind, playingEmbed, youtubeEmbed } from './media.ts';

test('YouTube links play in the privacy-enhanced player; anything else is not an embed', () => {
  assert.equal(youtubeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(youtubeEmbed('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(youtubeEmbed('https://www.youtube.com/shorts/abcdEFGH123'), 'https://www.youtube-nocookie.com/embed/abcdEFGH123');
  assert.equal(youtubeEmbed('https://evil.example/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(youtubeEmbed('https://www.youtube.com/watch?v=<script>'), null);
});

test('a media panel offers its own video first, then its choices', () => {
  const items = mediaItems({ kind: 'media', id: 'v', title: 'Tie a knot', url: 'https://www.youtube.com/watch?v=Gu_u8HymQPw', channel: 'Howcast', length: '1:24', choices: [{ title: 'Another', url: 'https://www.youtube.com/watch?v=GkjAuVW7eds' }] });
  assert.deepEqual(items.map((i) => i.title), ['Tie a knot', 'Another']);
  assert.equal(byline(items[0]!), 'Howcast · 1:24');
  assert.equal(byline(items[1]!), '');
});

test('each item plays in the right player', () => {
  assert.equal(mediaKind({ title: 'a', url: 'https://youtu.be/dQw4w9WgXcQ' }), 'youtube');
  assert.equal(mediaKind({ title: 'a', url: 'https://cdn.example/a.mp4?x=1' }), 'video');
  assert.equal(mediaKind({ title: 'a', url: 'https://cdn.example/a.mp3' }), 'audio');
  assert.equal(mediaKind({ title: 'a', url: 'https://cdn.example/a.jpg' }), 'picture');
  assert.equal(mediaKind({ title: 'a', url: '', path: '/Users/ada/Movies/Trip.MOV' }), 'video');
  assert.equal(mediaKind({ title: 'a', url: '', path: '/Users/ada/Music/Song.m4a' }), 'audio');
});

test('pressing Play starts the privacy-enhanced player at once', () => {
  // FIX-0044: the player page comes from Keeper's loopback server, never the app's own address.
  assert.equal(playingEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'http://127.0.0.1:50123'), 'http://127.0.0.1:50123/youtube/dQw4w9WgXcQ');
  assert.equal(playingEmbed('https://evil.example/x', 'http://127.0.0.1:50123'), null);
  assert.equal(playingEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://evil.example'), null, 'only the loopback player');
});

test('a file on this computer is named by its file name', () => {
  const [first] = mediaItems({ kind: 'media', id: 'm', title: 'Videos on this Mac', url: '', path: '/Users/ada/Movies/Trip 2025.mp4' });
  assert.equal(first?.title, 'Trip 2025.mp4');
  assert.equal(fileName('C:\\Users\\ada\\Videos\\a.mp4'), 'a.mp4');
});
