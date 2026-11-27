/**
 * The Shepherd's Crook (slot `held`, humans; the God Keeper's Good Shepherd set): a tall staff of
 * olive wood held in the right hand, its foot near the ground and its top above the shoulder,
 * curling forward into a crook. The wood has knots and a gentle bend; a leather wrap binds the grip
 * (above and below the hand), three gold bands sit under the curl and a gold cap finishes its tip.
 * A soft light rests in the curl, brightening as the keeper works and flaring when a reply arrives.
 *
 * Pattern: Adapter. Sized from the hand the body publishes (`fit.ts`), the staff passes through
 * that hand, tipped forward so it stands in front of the arm, never through it. It rides the arm.
 *
 * Effects: `color` (the wood), `trim` (the gold bands and cap) and `glow` (the light in the curl).
 */
import { CatmullRomCurve3, Color, Group, MeshPhysicalMaterial, PointLight, SphereGeometry, TorusGeometry, TubeGeometry, Vector3, type BufferGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { radiusAt, type PartFit } from '../fit.ts';
import { lightMaterial, metalMaterial } from '../glow-kit.ts';
import { leatherMaterial } from '../leather.ts';
import { meshAdder, merged } from '../detail-kit.ts';
import type { PartFrame, PartInstance } from '../part';

/** In multiples of the hand's radius: how far the staff reaches up and down, its thickness, the curl. */
const UP = 18;
const DOWN = 8.4;
const STAFF = 0.27;
const CURL = 1.9;
/** The staff stands tipped forward (radians about x) and a touch outward (about z). */
const TIP_FORWARD = 0.17;
const TIP_OUT = 0.05;
const KNOTS = 6;

export function createShepherdCrook(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'shepherd-crook';
  if (!fit.shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };
  const hand = radiusAt(fit.shape, 0) || 0.1;
  const woodColour = new Color(effectColour(effects, 'color'));
  const wood = new MeshPhysicalMaterial({ color: woodColour, roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.5, sheen: 0.4, sheenColor: woodColour.clone().lerp(new Color(0xffffff), 0.3) });
  const darkWood = new MeshPhysicalMaterial({ color: woodColour.clone().multiplyScalar(0.6), roughness: 0.7 });
  const gold = metalMaterial(effectColour(effects, 'trim'), 0.24, 0.06);
  const leather = leatherMaterial(0x5a3a1a, 0.7);
  const glow = effectNumber(effects, 'glow');
  const lightColour = new Color(0xffe3a0);
  const light = lightMaterial(lightColour.getHex(), 1.4 * glow, 0.9);
  const haze = lightMaterial(lightColour.getHex(), 0.5 * glow, 0.35);

  const staff = new Group();
  staff.name = 'staff';
  staff.rotation.set(TIP_FORWARD, 0, -TIP_OUT);
  group.add(staff);
  const add = meshAdder(staff);
  const r = STAFF * hand;
  const top = UP * hand;
  const bottom = -DOWN * hand;

  // The shaft: a gently bent line, so it reads as a cut branch, not a rod.
  const shaft = new CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => {
    const y = bottom + ((top - bottom) * i) / 8;
    return new Vector3(Math.sin(i * 1.3) * r * 0.5, y, Math.sin(i * 0.9 + 1) * r * 0.4);
  }));
  add(new TubeGeometry(shaft, 120, r, 14), wood, 'crook-shaft');
  const knots: BufferGeometry[] = [];
  for (let k = 0; k < KNOTS; k++) {
    const t = 0.08 + (0.84 * k) / (KNOTS - 1) + (k % 2 ? 0.03 : -0.02);
    if (Math.abs(bottom + (top - bottom) * t) < hand * 2.2) continue; // no knot under the hand
    const p = shaft.getPoint(t);
    const a = k * 2.4;
    knots.push(new SphereGeometry(r * 0.55, 10, 8).scale(1, 1.6, 1).translate(p.x + Math.cos(a) * r * 0.7, p.y, p.z + Math.sin(a) * r * 0.7));
  }
  if (knots.length) add(merged(knots), darkWood, 'crook-knots');

  // The crook: from the top of the shaft it curls forward and over, tightening to its tip.
  const head = shaft.getPoint(1);
  const curlPoints = Array.from({ length: 40 }, (_, i) => {
    const t = i / 39;
    const a = t * Math.PI * 1.45;
    const radius = CURL * hand * (1 - 0.35 * t);
    // Centre of the curl forward of the shaft's top; the angle starts pointing back down the shaft.
    return new Vector3(head.x, head.y + Math.sin(a) * radius, head.z + CURL * hand - Math.cos(a) * radius);
  });
  const curl = new CatmullRomCurve3(curlPoints);
  const curlTube = new TubeGeometry(curl, 80, r * 0.94, 14);
  add(curlTube, wood, 'crook-curl');
  const tip = curl.getPoint(1);
  add(new SphereGeometry(r * 1.15, 16, 12).translate(tip.x, tip.y, tip.z), gold, 'crook-tip');

  // Three gold bands under the curl and a leather wrap above and below the hand.
  const bands = [0.9, 0.93, 0.96].map((t, k) => {
    const p = shaft.getPoint(t);
    return new TorusGeometry(r * (k === 1 ? 1.3 : 1.18), r * (k === 1 ? 0.24 : 0.16), 8, 24).rotateX(Math.PI / 2).translate(p.x, p.y, p.z);
  });
  add(merged(bands), gold, 'crook-bands');
  const wrap = Array.from({ length: 18 }, (_, k) => {
    const y = -hand * 2.4 + (k * hand * 4.8) / 17;
    const t = (y - bottom) / (top - bottom);
    const p = shaft.getPoint(t);
    return new TorusGeometry(r * 1.12, r * 0.2, 6, 20).rotateX(Math.PI / 2 + (k % 2 ? 0.18 : -0.18)).translate(p.x, y, p.z);
  });
  add(merged(wrap), leather, 'crook-wrap');
  const foot = shaft.getPoint(0);
  add(new SphereGeometry(r * 1.1, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(foot.x, foot.y, foot.z), gold, 'crook-foot');

  // The light resting in the curl, and its haze.
  const centre = new Vector3(head.x, head.y + CURL * hand * 0.05, head.z + CURL * hand);
  add(new SphereGeometry(hand * 0.42, 20, 14).translate(centre.x, centre.y, centre.z), light, 'crook-light');
  add(new SphereGeometry(hand * 0.85, 20, 14).translate(centre.x, centre.y, centre.z), haze, 'crook-light');
  const lamp = new PointLight(lightColour, 0, hand * 14, 2);
  lamp.position.copy(centre);
  staff.add(lamp);

  return {
    group,
    pivotY: 0,
    update(frame: PartFrame) {
      const breath = 0.85 + 0.15 * Math.sin(frame.time * 1.7);
      const bright = glow * breath * (1 + 0.6 * frame.work + 1.4 * frame.gotIt);
      light.opacity = Math.min(0.55 + 0.25 * bright, 1);
      haze.opacity = 0.18 + 0.14 * bright;
      lamp.intensity = 0.18 * bright;
    },
    dispose: () => disposeTree(group),
  };
}
