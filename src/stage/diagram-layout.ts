/**
 * A layered (Sugiyama-style, simplified) layout for the diagram panel (pure, deterministic;
 * tested in diagram-layout.test.ts). No library: nodes are ranked top to bottom by the longest
 * path from a source (cycles are broken at the earliest node in the given order), ordered within
 * each row by the barycentre of their parents (one pass down, one up), then placed side by side
 * with a fixed gap and each row centred. Nodes in one row never overlap and rows are a fixed
 * height apart, so no two nodes overlap.
 *
 * Edges come back as SVG cubic paths: downward edges leave a node's bottom and enter the target's
 * top; edges that go up or sideways (a cycle, a same-row link) loop out to the right.
 *
 * Usage: `const g = layoutDiagram(panel.nodes, panel.edges)`; draw in a `0 0 g.width g.height`
 * viewBox.
 */

export interface LayoutNode { id: string; label: string; group?: string; x: number; y: number; w: number; h: number; rank: number }
export interface LayoutEdge { from: string; to: string; label?: string; path: string; mid: { x: number; y: number } }
export interface DiagramLayout { nodes: LayoutNode[]; edges: LayoutEdge[]; width: number; height: number }

export const NODE_H = 38;
const ROW_GAP = 74;
const COL_GAP = 26;
const PAD = 24;
/** Labels longer than this are shortened with an ellipsis (the full label stays in the title). */
export const LABEL_MAX = 24;
const CHAR_W = 7.4;

export function shortLabel(label: string): string {
  return label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 1)}…` : label;
}

export function nodeWidth(label: string): number {
  return Math.round(Math.min(220, Math.max(76, shortLabel(label).length * CHAR_W + 32)));
}

/** Ranks by longest path from a source; a cycle is broken at its first node in `ids` order. */
function rankNodes(ids: string[], parents: Map<string, string[]>): Map<string, number> {
  const rank = new Map<string, number>();
  const remaining = new Set(ids);
  while (remaining.size > 0) {
    let ready = ids.filter((id) => remaining.has(id) && (parents.get(id) ?? []).every((p) => !remaining.has(p)));
    if (ready.length === 0) ready = [ids.find((id) => remaining.has(id)) as string];
    for (const id of ready) {
      const placed = (parents.get(id) ?? []).filter((p) => rank.has(p)).map((p) => (rank.get(p) ?? 0) + 1);
      rank.set(id, Math.max(0, ...placed));
      remaining.delete(id);
    }
  }
  return rank;
}

/** Re-orders `row` by the mean position of each node's neighbours in `ref` (stable for ties). */
function byBarycentre(row: string[], ref: string[], neighbours: Map<string, string[]>): string[] {
  const position = new Map(ref.map((id, i) => [id, i]));
  const score = (id: string, i: number) => {
    const known = (neighbours.get(id) ?? []).filter((n) => position.has(n)).map((n) => position.get(n) as number);
    return known.length ? known.reduce((a, b) => a + b, 0) / known.length : i;
  };
  return row.map((id, i) => ({ id, s: score(id, i), i })).sort((a, b) => a.s - b.s || a.i - b.i).map((r) => r.id);
}

export function layoutDiagram(
  nodes: { id: string; label: string; group?: string }[],
  edges: { from: string; to: string; label?: string }[],
): DiagramLayout {
  const seen = new Set<string>();
  const unique = nodes.filter((n) => !seen.has(n.id) && seen.add(n.id));
  const ids = unique.map((n) => n.id);
  const known = edges.filter((e) => seen.has(e.from) && seen.has(e.to) && e.from !== e.to);
  const parents = new Map<string, string[]>(ids.map((id) => [id, []]));
  const children = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of known) { parents.get(e.to)?.push(e.from); children.get(e.from)?.push(e.to); }

  const rank = rankNodes(ids, parents);
  const rowCount = Math.max(0, ...rank.values()) + 1;
  let rows: string[][] = Array.from({ length: rowCount }, (_, r) => ids.filter((id) => rank.get(id) === r));
  for (let r = 1; r < rows.length; r += 1) rows[r] = byBarycentre(rows[r], rows[r - 1], parents);
  for (let r = rows.length - 2; r >= 0; r -= 1) rows[r] = byBarycentre(rows[r], rows[r + 1], children);
  rows = rows.filter((row) => row.length > 0);

  const byId = new Map(unique.map((n) => [n.id, n]));
  const rowWidth = (row: string[]) => row.reduce((sum, id) => sum + nodeWidth(byId.get(id)?.label ?? ''), 0) + COL_GAP * (row.length - 1);
  const inner = Math.max(0, ...rows.map(rowWidth));
  const width = inner + PAD * 2;
  const placed = new Map<string, LayoutNode>();
  rows.forEach((row, r) => {
    let x = PAD + (inner - rowWidth(row)) / 2;
    for (const id of row) {
      const n = byId.get(id) as { id: string; label: string; group?: string };
      const w = nodeWidth(n.label);
      placed.set(id, { ...n, x: x + w / 2, y: PAD + r * (NODE_H + ROW_GAP) + NODE_H / 2, w, h: NODE_H, rank: r });
      x += w + COL_GAP;
    }
  });

  const laid = known.map((e) => edgePath(e, placed.get(e.from) as LayoutNode, placed.get(e.to) as LayoutNode));
  const height = rows.length * NODE_H + Math.max(0, rows.length - 1) * ROW_GAP + PAD * 2;
  // Loop-backs bulge right of the nodes; widen the canvas so they are never clipped.
  const loopRoom = laid.some((e) => e.loop) ? 46 : 0;
  return { nodes: ids.map((id) => placed.get(id) as LayoutNode), edges: laid.map((e) => e.edge), width: width + loopRoom, height };
}

function edgePath(e: { from: string; to: string; label?: string }, a: LayoutNode, b: LayoutNode): { edge: LayoutEdge; loop: boolean } {
  const down = b.rank > a.rank;
  const [x1, y1] = down ? [a.x, a.y + a.h / 2] : [a.x + a.w / 2, a.y];
  const [x4, y4] = down ? [b.x, b.y - b.h / 2 - 4] : [b.x + b.w / 2 + 4, b.y];
  const bend = down ? (y4 - y1) / 2 : 46;
  const [x2, y2, x3, y3] = down ? [x1, y1 + bend, x4, y4 - bend] : [x1 + bend, y1, x4 + bend, y4];
  const round = (v: number) => Math.round(v * 10) / 10;
  const mid = { x: round((x1 + 3 * x2 + 3 * x3 + x4) / 8), y: round((y1 + 3 * y2 + 3 * y3 + y4) / 8) };
  const path = `M ${round(x1)} ${round(y1)} C ${round(x2)} ${round(y2)}, ${round(x3)} ${round(y3)}, ${round(x4)} ${round(y4)}`;
  return { edge: { from: e.from, to: e.to, label: e.label, path, mid }, loop: !down };
}

/** The colour slot (0..5) of each group, by first appearance; nodes without a group take slot 0. */
export function groupSlots(nodes: { group?: string }[]): Map<string, number> {
  const slots = new Map<string, number>();
  for (const n of nodes) if (n.group && !slots.has(n.group)) slots.set(n.group, slots.size % 6);
  return slots;
}
