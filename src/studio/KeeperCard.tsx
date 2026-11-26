/**
 * Save a card of this keeper: a picture of it as it looks on the Studio's stage with its name,
 * level and soul, written to the Downloads folder as a PNG the person can post. Drawn here on a
 * canvas; nothing is uploaded anywhere.
 */
import { useState } from 'react';

import { core, sentence } from '../kernel/ipc';
import { CARD, cardLines, coverRect, fitSize, type CardFacts } from './keeper-card';

const NAVY = '#0b1020';
const GOLD = '#f0c98a';
const CREAM = '#f4eee2';
const SERIF = '"New York", "Iowan Old Style", Georgia, serif';
const SANS = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif';

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("I couldn't take the picture."));
    image.src = url;
  });
}

/** The card as PNG bytes in base64 (no data-URL prefix). */
async function draw(picture: string, facts: CardFacts): Promise<string> {
  const image = await load(picture);
  const canvas = document.createElement('canvas');
  canvas.width = CARD.width;
  canvas.height = CARD.height;
  const c = canvas.getContext('2d');
  if (!c) throw new Error("I couldn't draw the card.");
  c.fillStyle = NAVY;
  c.fillRect(0, 0, CARD.width, CARD.height);
  const crop = coverRect(image.naturalWidth, image.naturalHeight, CARD.picture, CARD.picture);
  c.save();
  c.beginPath();
  c.roundRect(CARD.margin, CARD.margin, CARD.picture, CARD.picture, 36);
  c.clip();
  c.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, CARD.margin, CARD.margin, CARD.picture, CARD.picture);
  c.restore();
  c.strokeStyle = 'rgba(240, 201, 138, 0.45)';
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(CARD.margin, CARD.margin, CARD.picture, CARD.picture, 36);
  c.stroke();

  const lines = cardLines(facts);
  const centre = CARD.width / 2;
  const room = CARD.width - 120;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  const measure = (font: (size: number) => string, text: string) => (size: number) => {
    c.font = font(size);
    return c.measureText(text).width;
  };
  const title = (size: number) => `600 ${size}px ${SERIF}`;
  c.font = title(fitSize([96, 80, 64, 52, 42], room, measure(title, lines.title)));
  c.fillStyle = GOLD;
  c.fillText(lines.title, centre, 1172);
  const sub = (size: number) => `400 ${size}px ${SANS}`;
  c.font = sub(fitSize([38, 32, 27, 23], room, measure(sub, lines.sub)));
  c.fillStyle = CREAM;
  c.fillText(lines.sub, centre, 1236);
  c.font = `500 24px ${SANS}`;
  c.fillStyle = 'rgba(244, 238, 226, 0.55)';
  c.fillText(lines.foot, centre, 1306);
  return canvas.toDataURL('image/png').split(',')[1] ?? '';
}

export function KeeperCard({ facts, snapshot }: { facts: CardFacts; snapshot: () => string | null }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  const save = async () => {
    setBusy(true);
    setNote(null);
    try {
      const picture = snapshot();
      if (!picture) throw new Error("I couldn't take the picture. Try again in a moment.");
      await core.cardSave(facts.name, await draw(picture, facts));
      setNote({ text: 'Saved to your Downloads folder.', bad: false });
    } catch (e) {
      setNote({ text: sentence(e), bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-card keeper-card">
      <div>
        <strong>A card of {facts.name}</strong>
        <p className="muted small">A picture of {facts.name} as it looks now, with its name, level and soul. It is saved on this Mac; you choose where it goes.</p>
      </div>
      <button type="button" className="btn btn-small" disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save the card'}
      </button>
      {note && <p className={note.bad ? 'error-line' : 'muted small'}>{note.text}</p>}
    </div>
  );
}
