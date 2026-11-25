/**
 * The puppy's sweat drop: at the very top of the work dial a single glinting droplet beads
 * on the side of its head and slides down, over and over, like a cartoon "working hard"
 * bead (a cool glint that blooms softly, not a realistic drop).
 *
 * The drop rides the skull's surface: its path is projected onto the skull ellipsoid each
 * frame with plain arithmetic (no allocation). `amount` 0 hides it entirely.
 */
import { Color, Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { PALETTE } from '../../palette';
import type { PuppyKit } from './puppy-kit';
import { SKULL } from './puppy-head';

/** Seconds per bead (form, slide, fade) and where on the head it runs (head space). */
const BEAD_SECONDS = 1.7;
const PATH = { x: 0.46, yTop: 0.6, yBottom: 0.3, z: 0.55 };
const SIZE = 0.06;

export interface PuppySweat {
  /** `amount` 0..1 (how much shows), `time` and the reduced-motion `speed`. */
  update(amount: number, time: number, speed: number): void;
}

export function addPuppySweat(head: Object3D, kit: PuppyKit): PuppySweat {
  const glint = new MeshBasicMaterial({ color: new Color(PALETTE.sweatGlint).multiplyScalar(2.2), transparent: true });
  const drop = kit.blob(head, glint, [SIZE * 0.75, SIZE, SIZE * 0.6], [PATH.x, PATH.yTop, PATH.z]);
  drop.name = 'sweat-drop';
  drop.visible = false;

  return {
    update(amount, time, speed) {
      if (amount <= 0.01) {
        drop.visible = false;
        return;
      }
      const cycle = (time * speed) / BEAD_SECONDS;
      const age = cycle - Math.floor(cycle);
      const slide = age < 0.3 ? 0 : (age - 0.3) / 0.7;
      placeOnSkull(drop, PATH.x, PATH.yTop + (PATH.yBottom - PATH.yTop) * slide * slide, PATH.z);
      const grow = Math.min(age / 0.3, 1);
      drop.scale.set(SIZE * 0.75 * grow * amount, SIZE * (0.8 + 0.4 * slide) * grow * amount, SIZE * 0.6 * grow * amount);
      glint.opacity = Math.min(1, (1 - slide) * 1.6);
      drop.visible = true;
    },
  };
}

/** Moves `mesh` to the skull surface along the ray from the head centre through (x, y, z). */
function placeOnSkull(mesh: Mesh, x: number, y: number, z: number): void {
  const k = 1.03 / Math.hypot(x / SKULL[0], y / SKULL[1], z / SKULL[2]);
  mesh.position.set(x * k, y * k, z * k);
}
