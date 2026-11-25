/**
 * A diagram panel: nodes and edges laid out top to bottom by `layoutDiagram` (pure, no library)
 * and drawn in SVG. Nodes are rounded gold-edged chips coloured by group; edges are curved
 * arrows with optional labels. Edges draw in, nodes pop in, a legend names the groups, and
 * clicking (or Enter on) a node asks about it.
 */
import { useId, useMemo, type KeyboardEvent } from 'react';

import { groupSlots, layoutDiagram, shortLabel } from '../diagram-layout.ts';
import { nodeWhat } from '../focus.ts';
import { stagger } from '../stagger.ts';
import type { PanelProps } from './panel-props.ts';

export function DiagramPanel({ panel, onPick }: PanelProps<'diagram'>) {
  const layout = useMemo(() => layoutDiagram(panel.nodes, panel.edges), [panel.nodes, panel.edges]);
  const slots = useMemo(() => groupSlots(panel.nodes), [panel.nodes]);
  const arrow = `${useId().replace(/:/g, '')}-arrow`;
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const onKey = (label: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(nodeWhat(label)); }
  };

  return (
    <div className="diagram">
      <svg className="diagram-svg" viewBox={`0 0 ${layout.width} ${layout.height}`} role="group" aria-label={panel.title}
        style={{ maxWidth: `${layout.width * 1.25}px` }}>
        <defs>
          <marker id={arrow} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path className="diagram-arrowhead" d="M 0 1 L 9 5 L 0 9 z" />
          </marker>
        </defs>
        {layout.edges.map((e, i) => (
          <g key={`e${i}`} className="diagram-edge" style={stagger(i)}>
            <path d={e.path} pathLength={1} markerEnd={`url(#${arrow})`} />
            {e.label && (
              <g className="diagram-edge-label" transform={`translate(${e.mid.x} ${e.mid.y})`}>
                <rect x={-(shortLabel(e.label).length * 3.3 + 8)} y={-9} width={shortLabel(e.label).length * 6.6 + 16} height={18} rx={9} />
                <text textAnchor="middle" dy="4">{shortLabel(e.label)}</text>
              </g>
            )}
          </g>
        ))}
        {layout.nodes.map((n, i) => {
          const slot = n.group ? slots.get(n.group) ?? 0 : 0;
          const inbound = layout.edges.filter((e) => e.to === n.id).map((e) => byId.get(e.from)?.label).filter(Boolean);
          return (
            <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
              <g className={`diagram-node slot-${slot}`} style={stagger(i)} role="button" tabIndex={0}
                aria-label={`${n.label}${n.group ? `, ${n.group}` : ''}${inbound.length ? `, from ${inbound.join(', ')}` : ''}`}
                onClick={() => onPick(nodeWhat(n.label))} onKeyDown={onKey(n.label)}>
                <title>{n.label}</title>
                <rect x={-n.w / 2} y={-n.h / 2} width={n.w} height={n.h} rx={n.h / 2} />
                <circle cx={-n.w / 2 + 16} cy={0} r={4.5} />
                <text x={6} textAnchor="middle" dy="4.5">{shortLabel(n.label)}</text>
              </g>
            </g>
          );
        })}
      </svg>
      {slots.size > 1 && (
        <ul className="diagram-legend">
          {[...slots.entries()].map(([group, slot]) => (
            <li key={group} className={`slot-${slot}`}><i aria-hidden="true" />{group}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
