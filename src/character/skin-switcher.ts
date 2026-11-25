/**
 * Holds the skin the character is wearing and plays the live swap to another one.
 *
 * Each skin's `root` sits inside a holder group owned here, so the swap can scale and
 * turn a whole skin without touching the transforms the skin animates itself. During a
 * swap both skins are posed every frame (the old one keeps breathing as it shrinks);
 * when the timeline (`skins/skin-transition.ts`) says done, the old skin is disposed.
 * A swap requested mid-swap finishes the old one at once and starts again from there.
 */
import { Group, type Object3D } from 'three';
import type { Skin, SkinFrame } from './skins';
import { swapPose } from './skins/skin-transition';

interface Worn {
  skin: Skin;
  holder: Group;
}

export class SkinSwitcher {
  private readonly parent: Object3D;
  private current: Worn;
  private outgoing: Worn | null = null;
  private swapStartedAt = 0;
  private pointScale = 0;

  constructor(parent: Object3D, first: Skin) {
    this.parent = parent;
    this.current = this.wear(first);
  }

  /** The skin being worn (during a swap: the incoming one). */
  get active(): Skin {
    return this.current.skin;
  }

  /** True while a swap is playing (touch hit-testing waits for it to settle). */
  get swapping(): boolean {
    return this.outgoing !== null;
  }

  /** Starts swapping to `next` at animator time `time`. */
  swap(next: Skin, time: number): void {
    if (this.outgoing) this.release(this.outgoing);
    this.outgoing = this.current;
    this.current = this.wear(next);
    place(this.current.holder, 0, -1);
    this.swapStartedAt = time;
  }

  /** Poses the worn skin(s) for this frame and advances the swap. */
  apply(frame: SkinFrame): void {
    if (this.outgoing) {
      const pose = swapPose(frame.time - this.swapStartedAt);
      place(this.outgoing.holder, pose.outgoing, 1);
      place(this.current.holder, pose.incoming, -1);
      this.outgoing.skin.apply(frame);
      if (pose.done) {
        this.release(this.outgoing);
        this.outgoing = null;
        place(this.current.holder, 1, 1);
      }
    }
    this.current.skin.apply(frame);
  }

  /** Device pixels per world unit, forwarded to skins that draw point sprites (and new ones). */
  setPointScale(scale: number): void {
    this.pointScale = scale;
    this.current.skin.setPointScale?.(scale);
    this.outgoing?.skin.setPointScale?.(scale);
  }

  dispose(): void {
    if (this.outgoing) this.release(this.outgoing);
    this.outgoing = null;
    this.release(this.current);
  }

  private wear(skin: Skin): Worn {
    const holder = new Group();
    holder.name = `skin-${skin.id}`;
    holder.add(skin.root);
    this.parent.add(holder);
    if (this.pointScale > 0) skin.setPointScale?.(this.pointScale);
    return { skin, holder };
  }

  private release(worn: Worn): void {
    worn.skin.dispose();
    worn.holder.removeFromParent();
  }
}

/** World height the swap scales about: just above the ark, so skins grow up out of it. */
const SWAP_PIVOT_Y = -2;

/**
 * Scale about SWAP_PIVOT_Y (never exactly 0: three.js cannot invert a zero matrix) with a
 * small turn while small. At scale 1 the holder is back at the identity transform.
 */
function place(holder: Group, scale: number, turn: number): void {
  const s = Math.max(scale, 1e-4);
  holder.scale.setScalar(s);
  holder.position.y = SWAP_PIVOT_Y * (1 - s);
  holder.visible = scale > 0.002;
  holder.rotation.y = scale >= 1 ? 0 : (1 - Math.min(scale, 1)) * 0.9 * turn;
}
