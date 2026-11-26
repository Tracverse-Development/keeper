import assert from 'node:assert/strict';
import { test } from 'node:test';

import { youtubeEmbed } from './media.ts';

test('YouTube links play in the privacy-enhanced player; anything else is not an embed', () => {
  assert.equal(youtubeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(youtubeEmbed('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(youtubeEmbed('https://www.youtube.com/shorts/abcdEFGH123'), 'https://www.youtube-nocookie.com/embed/abcdEFGH123');
  assert.equal(youtubeEmbed('https://evil.example/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(youtubeEmbed('https://www.youtube.com/watch?v=<script>'), null);
});
