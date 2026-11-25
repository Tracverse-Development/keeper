/**
 * What every panel renderer takes: its own panel (narrowed by kind) and `onPick`, called with the
 * words for the piece the person pointed at (built by `../focus.ts`).
 */
import type { Panel, PanelKind } from '../panel-spec.ts';

export interface PanelProps<K extends PanelKind> {
  panel: Extract<Panel, { kind: K }>;
  onPick: (what: string) => void;
}
