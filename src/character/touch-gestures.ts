/**
 * Wires pointer events on the character's canvas to touch reactions.
 *
 * Every pointer reading is hit-tested against the worn skin (`Character.hitTest`, in the
 * canvas's normalised device coordinates) and fed to the pure `GestureTracker`; a poke
 * or pat it reports is played (`Character.react`) and announced through `notify`. The
 * cursor shows a pointer over the character and a grabbing hand while stroking. Gaze is
 * NOT handled here: the stage follows the pointer over the whole window separately, so
 * looking works everywhere, touched or not.
 */
import type { Character, HitRegion, TouchKind } from './contract';
import { GestureTracker, type GestureEvent, type GestureSample } from './gesture';

export type TouchListener = (kind: TouchKind, region: HitRegion) => void;

/** Starts listening on `canvas`; returns the function that stops it. */
export function attachTouchGestures(canvas: HTMLCanvasElement, character: Character, notify: TouchListener): () => void {
  const tracker = new GestureTracker();

  const sample = (event: PointerEvent): GestureSample => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    const y = 1 - ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2;
    return { x: event.clientX, y: event.clientY, t: event.timeStamp, region: character.hitTest(x, y) };
  };
  const fire = (gesture: GestureEvent | null): void => {
    if (!gesture) return;
    character.react(gesture.kind);
    notify(gesture.kind, gesture.region);
  };
  const showCursor = (region: HitRegion | null): void => {
    const cursor = tracker.cursor(region);
    canvas.style.cursor = cursor === 'default' ? '' : cursor;
  };

  const onDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const reading = sample(event);
    tracker.down(reading);
    // Keep receiving the stroke even if it slips off the canvas edge mid-pat.
    if (reading.region) canvas.setPointerCapture?.(event.pointerId);
    showCursor(reading.region);
  };
  const onMove = (event: PointerEvent): void => {
    const reading = sample(event);
    fire(tracker.move(reading));
    showCursor(reading.region);
  };
  const onUp = (event: PointerEvent): void => {
    const reading = sample(event);
    fire(tracker.up(reading));
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    showCursor(reading.region);
  };
  const onCancel = (): void => {
    tracker.cancel();
    showCursor(null);
  };
  const onLeave = (): void => {
    if (!tracker.pressed) canvas.style.cursor = '';
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.style.cursor = '';
  };
}
