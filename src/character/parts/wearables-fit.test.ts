/**
 * The wardrobe's promise, proven: every worn wearable in the catalogue fits every species that
 * offers its slot, with no per-species code. Each part is BUILT (real three.js geometry, no GPU)
 * from the shape the species publishes, then measured against that shape: nothing sinks into the
 * body, the cloth sits close (it is fitted, not floating), sleeves wrap exactly the limbs the body
 * has (none on the armless robot), and the same holds for a made-up boxy, four-armed body.
 * Run: node --test --experimental-strip-types src/character/parts/wearables-fit.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Vector3, type Object3D } from 'three';
import { SKINS } from '../skins/catalog.ts';
import { PARTS, resolveWearables } from './catalog.ts';
import { resolveEffects } from './effects.ts';
import { bodyLevel, clearance, radiusAt, type BodyShape, type Limb } from './fit.ts';
import { isWornSlot, type SlotId } from './slots.ts';
import { WORN_FACTORIES } from './worn-parts.ts';

const WORN = PARTS.filter((p) => isWornSlot(p.slot));
/** The CR curve is read between samples: allow ~1 mm. */
const TOLERANCE = 0.0025;
/** Fitted, not floating: the closest piece stands at most this far off (the head is ~1 unit across). */
const SNUG = 0.12;

/** A body no shipped species has: boxy, flat, wide, with four arms. */
const BOXY: BodyShape = {
  profile: [[0.2, 0.05], [0.45, -0.05], [0.7, -0.4], [0.72, -0.8], [0.6, -1.2]],
  depth: 0.7,
  squareness: 4,
  reach: -0.95,
  limbs: [-1, 1].flatMap((side) => [-0.25, -0.6].map((y) => ({ position: [side * 0.66, y, 0.05], radius: 0.11, length: 0.5, tilt: 0.1 }) as Limb)),
};

function vertices(root: Object3D, keep: (mesh: Mesh) => boolean): Vector3[] {
  root.updateMatrixWorld(true);
  const out: Vector3[] = [];
  root.traverse((node) => {
    if (!(node instanceof Mesh) || !keep(node)) return;
    const position = node.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) out.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld));
  });
  return out;
}

const inSleeve = (mesh: Object3D): boolean => {
  for (let n: Object3D | null = mesh; n; n = n.parent) if (n.name === 'sleeve') return true;
  return false;
};

/** Every place a worn part can go: each species' slot, plus the boxy body as a torso, back and neck. */
function fittings(): { body: string; slot: SlotId; shape: BodyShape }[] {
  const out: { body: string; slot: SlotId; shape: BodyShape }[] = [];
  for (const skin of SKINS) {
    for (const [slot, placement] of Object.entries(skin.slots) as [SlotId, { shape?: BodyShape }][]) if (placement.shape) out.push({ body: skin.id, slot, shape: placement.shape });
  }
  for (const slot of ['torso', 'back', 'neck'] as const) out.push({ body: 'boxy', slot, shape: BOXY });
  return out;
}

for (const part of WORN) {
  for (const { body, slot, shape } of fittings().filter((f) => f.slot === part.slot)) {
    test(`${part.id} fits the ${body}'s ${slot}`, () => {
      const factory = WORN_FACTORIES[part.id as keyof typeof WORN_FACTORIES];
      const instance = factory(resolveEffects(part.effects, {}), { species: body, shape });
      const all = vertices(instance.group, () => true);
      assert.ok(all.length > 50, 'it has geometry');
      for (const v of all) assert.ok(Number.isFinite(v.x + v.y + v.z), 'finite');

      // Nothing sinks into the body (sleeves are measured against their limbs below).
      let worst = Infinity;
      for (const v of vertices(instance.group, (m) => !inSleeve(m))) {
        const r = radiusAt(shape, v.y);
        if (r > 0) worst = Math.min(worst, clearance(shape, v.x, v.y, v.z) * r); // above or below the body: clear
      }
      assert.ok(worst >= -TOLERANCE, `${part.id} sinks ${(-worst).toFixed(4)} into the ${body}`);

      // Fitted, not floating: the closest piece sits close to the body.
      assert.ok(worst <= SNUG, `${part.id} floats ${worst.toFixed(3)} off the ${body}`);

      // Sleeves: one per limb the shape lists, each wrapping its limb from outside.
      const sleeves: Object3D[] = [];
      instance.group.traverse((n) => n.name === 'sleeve' && sleeves.push(n));
      assert.equal(sleeves.length, part.id === 'ark-jacket' ? (shape.limbs?.length ?? 0) : 0, 'sleeves only where there are limbs');
      sleeves.forEach((sleeve, i) => {
        const limb = shape.limbs![i];
        for (const v of vertices(sleeve, () => true)) {
          const local = v.clone().sub(new Vector3(...limb.position)).applyAxisAngle(new Vector3(1, 0, 0), -limb.tilt);
          assert.ok(Math.hypot(local.x, local.z) >= limb.radius - TOLERANCE, 'a sleeve wraps its limb from outside');
        }
      });
      instance.update({ dt: 1 / 60, time: 3.2, motion: { amplitude: 1, speed: 1 }, mood: {}, voice: 0, work: 1, thinking: 0, gotIt: 0, head: new Vector3() } as never);
      for (const v of vertices(instance.group, (m) => !inSleeve(m))) assert.ok(bodyLevel(shape, v.x, v.y, v.z) >= 1 - 4 * TOLERANCE, 'moving cloth never passes into the body');
      instance.dispose();
    });
  }
}

test('every species offers every worn slot today, and a body without a slot simply goes without', () => {
  for (const part of WORN) for (const skin of SKINS) assert.ok(part.slot in skin.slots, `${skin.id} offers ${part.slot}`);
  // A wear list naming a part for a slot the body lacks resolves (the wardrobe then leaves it empty).
  const worn = resolveWearables([{ part: 'trail-pack' }, { part: 'crew-cap' }], 'puppy');
  assert.deepEqual(Object.keys(worn).sort(), ['back', 'head']);
});
