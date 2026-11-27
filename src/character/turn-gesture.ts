/**
 * The Studio's turn gesture: drag on the stage AROUND the keeper (not on it: a drag on the keeper
 * is still a pat, or picks it up) to walk round it and see its back; let go and it coasts; double
 * click resets to the front. The canvas also takes the keyboard: Left and Right turn by a step,
 * Home faces front, and T turns it round (Escape is left to the page: the Studio closes on it). `Character.turn` does the motion.
 */
import type { Character } from './contract';

/** Radians turned per stage width dragged (a full drag across shows a little more than the back). */
const RADIANS_PER_WIDTH = Math.PI * 1.25;
/** One arrow-key step (radians). */
const KEY_STEP = Math.PI / 6;

/** Starts listening on `canvas`; returns the function that stops it. */
export function attachTurnGesture(canvas: HTMLCanvasElement, character: Character): () => void {
  let dragging: { id: number; x: number } | null = null;
  const now = (event: Event): number => event.timeStamp / 1000;
  const onKeeper = (event: PointerEvent): boolean => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    const y = 1 - ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2;
    return character.hitTest(x, y) !== null;
  };

  const onDown = (event: PointerEvent): void => {
    if (event.button !== 0 || onKeeper(event)) return;
    dragging = { id: event.pointerId, x: event.clientX };
    canvas.setPointerCapture?.(event.pointerId);
    canvas.style.cursor = 'grabbing';
  };
  const onMove = (event: PointerEvent): void => {
    if (!dragging || event.pointerId !== dragging.id) return;
    const width = Math.max(canvas.getBoundingClientRect().width, 1);
    const delta = ((event.clientX - dragging.x) / width) * RADIANS_PER_WIDTH;
    dragging.x = event.clientX;
    character.turn({ kind: 'drag', delta, time: now(event) });
  };
  const onUp = (event: PointerEvent): void => {
    if (!dragging || event.pointerId !== dragging.id) return;
    dragging = null;
    canvas.style.cursor = '';
    character.turn({ kind: 'release', time: now(event) });
  };
  const onDoubleClick = (event: MouseEvent): void => {
    event.preventDefault();
    character.turn({ kind: 'to', yaw: 0 });
  };
  const onKey = (event: KeyboardEvent): void => {
    const command =
      event.key === 'ArrowLeft' ? ({ kind: 'by', delta: -KEY_STEP } as const)
      : event.key === 'ArrowRight' ? ({ kind: 'by', delta: KEY_STEP } as const)
      : event.key === 'Home' ? ({ kind: 'to', yaw: 0 } as const)
      : event.key === 't' || event.key === 'T' ? ({ kind: 'around' } as const)
      : null;
    if (!command) return;
    event.preventDefault();
    character.turn(command);
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('dblclick', onDoubleClick);
  canvas.addEventListener('keydown', onKey);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('dblclick', onDoubleClick);
    canvas.removeEventListener('keydown', onKey);
  };
}
