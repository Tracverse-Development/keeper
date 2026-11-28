/**
 * The dispatcher: draws a panel with its kind's renderer from the panel SDK (`registry.tsx`).
 * A new kind is one entry there; nothing changes here.
 */
import type { Panel, PanelAction } from '../panel-spec.ts';
import { panelKit } from './registry.tsx';

interface Props {
  panel: Panel;
  onPick: (what: string) => void;
  onAction: (a: PanelAction) => void;
}

export function PanelBody({ panel, onPick, onAction }: Props) {
  const Draw = panelKit(panel).draw;
  return <Draw panel={panel} onPick={onPick} onAction={onAction} />;
}
