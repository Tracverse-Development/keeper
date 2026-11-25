/**
 * Tests for the diagram layout (pure, deterministic).
 * Run: node --test --experimental-strip-types src/stage/diagram-layout.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupSlots, layoutDiagram, shortLabel, type LayoutNode } from './diagram-layout.ts';

const family = {
  nodes: [
    { id: 'g1', label: 'Grandpa Joe', group: 'grandparents' }, { id: 'g2', label: 'Grandma Ann', group: 'grandparents' },
    { id: 'p1', label: 'Mum', group: 'parents' }, { id: 'p2', label: 'Uncle Ray', group: 'parents' },
    { id: 'c1', label: 'You' }, { id: 'c2', label: 'Your sister' }, { id: 'c3', label: 'Cousin Lee' },
  ],
  edges: [
    { from: 'g1', to: 'p1' }, { from: 'g2', to: 'p1' }, { from: 'g1', to: 'p2' },
    { from: 'p1', to: 'c1', label: 'daughter' }, { from: 'p1', to: 'c2' }, { from: 'p2', to: 'c3' },
  ],
};

function overlaps(a: LayoutNode, b: LayoutNode): boolean {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
}
function assertNoOverlap(nodes: LayoutNode[]) {
  for (let i = 0; i < nodes.length; i += 1) for (let j = i + 1; j < nodes.length; j += 1) {
    assert.ok(!overlaps(nodes[i], nodes[j]), `${nodes[i].id} overlaps ${nodes[j].id}`);
  }
}

test('ranks follow the edges: parents above children', () => {
  const g = layoutDiagram(family.nodes, family.edges);
  const rank: Record<string, number> = Object.fromEntries(g.nodes.map((n) => [n.id, n.rank]));
  assert.deepEqual(rank, { g1: 0, g2: 0, p1: 1, p2: 1, c1: 2, c2: 2, c3: 2 });
  const rankOf = (id: string) => g.nodes.find((n) => n.id === id)?.rank ?? -1;
  for (const e of family.edges) assert.ok(rankOf(e.to) > rankOf(e.from));
  assert.equal(g.edges.length, 6);
  assert.match(g.edges[0].path, /^M [\d.]+ [\d.]+ C /);
});

test('the layout is deterministic and nodes never overlap', () => {
  const a = layoutDiagram(family.nodes, family.edges);
  assert.deepEqual(a, layoutDiagram(family.nodes, family.edges));
  assertNoOverlap(a.nodes);
  for (const n of a.nodes) {
    assert.ok(n.x - n.w / 2 >= 0 && n.x + n.w / 2 <= a.width, `${n.id} inside the width`);
    assert.ok(n.y - n.h / 2 >= 0 && n.y + n.h / 2 <= a.height, `${n.id} inside the height`);
  }
});

test('cycles, self-loops, unknown ends and duplicates do not break it', () => {
  const g = layoutDiagram(
    [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }, { id: 'a', label: 'again' }, { id: 'lone', label: 'Alone' }],
    [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }, { from: 'a', to: 'a' }, { from: 'a', to: 'ghost' }],
  );
  assert.equal(g.nodes.length, 4);
  assert.equal(g.edges.length, 3);
  assertNoOverlap(g.nodes);
  assert.equal(g.nodes.find((n) => n.id === 'a')?.label, 'A');
  assert.ok(g.edges.every((e) => Number.isFinite(e.mid.x) && Number.isFinite(e.mid.y)));
});

test('empty graphs and long labels', () => {
  const empty = layoutDiagram([], []);
  assert.equal(empty.nodes.length, 0);
  assert.ok(empty.width > 0 && empty.height > 0);
  assert.equal(shortLabel('A very long label that goes on and on'), 'A very long label that …');
  assert.equal(shortLabel('Short'), 'Short');
});

test('groups take colour slots by first appearance', () => {
  const slots = groupSlots(family.nodes);
  assert.deepEqual([...slots.entries()], [['grandparents', 0], ['parents', 1]]);
});
