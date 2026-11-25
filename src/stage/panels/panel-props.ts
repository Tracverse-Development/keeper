/**
 * What every panel renderer takes: its own panel (narrowed by kind) and `onPick`, called with the
 * words for the piece the person pointed at (built by `../focus.ts`). Panels the person works IN
 * (ticks, answers, approvals) take `ActingPanelProps`, which adds `onAction` for what they DID.
 */
import type { Panel, PanelAction, PanelKind } from '../panel-spec.ts';

export interface PanelProps<K extends PanelKind> {
  panel: Extract<Panel, { kind: K }>;
  onPick: (what: string) => void;
}

export interface ActingPanelProps<K extends PanelKind> extends PanelProps<K> {
  onAction: (a: PanelAction) => void;
}
