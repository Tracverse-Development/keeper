/**
 * The window's panel SDK: ONE record that knows everything the window needs about each panel
 * kind (the Keeper SDK's window side; the core side is `src-tauri/src/stage/panel.rs`). A kind's
 * kit holds:
 *
 * - `label`: the small eyebrow word over the title ("Step by step").
 * - `help`: one short plain sentence under the title saying what the person can DO with it, so no
 *   panel is a picture with no way in (founder 2026-11-26). Held complete and plain by
 *   `registry.test.ts`.
 * - `wide`: whether the card takes the full width of the stage grid (the rest pair up two by
 *   two): `true`, `false`, or a rule on the panel's own content (cards wide only past two).
 * - `draw`: the renderer (`./<Kind>Panel.tsx`), given `ActingPanelProps<K>`; a renderer that only
 *   shows things takes `PanelProps<K>` and ignores `onAction`.
 *
 * The record is a mapped type over `PanelKind`, so a kind added to `panel-spec.ts` without a kit
 * here fails the typecheck. Adding a kind: docs/design/keeper-sdk.md, "Panels".
 *
 * Use: `<PanelBody panel …/>` draws a panel; `panelKit(panel)` reads its kit; `isWide(panel)`.
 */
import type { ComponentType } from 'react';

import type { Panel, PanelKind } from '../panel-spec.ts';
import { AgendaPanel } from './AgendaPanel.tsx';
import { ApprovalPanel } from './ApprovalPanel.tsx';
import { CardsPanel } from './CardsPanel.tsx';
import { ChartPanel } from './ChartPanel.tsx';
import { ChecklistPanel } from './ChecklistPanel.tsx';
import { DiagramPanel } from './DiagramPanel.tsx';
import { DraftPanel } from './DraftPanel.tsx';
import { FactsPanel } from './FactsPanel.tsx';
import { FilePanel } from './FilePanel.tsx';
import { FilesPanel } from './FilesPanel.tsx';
import { FlashcardsPanel } from './FlashcardsPanel.tsx';
import { FolderPanel } from './FolderPanel.tsx';
import { FormPanel } from './FormPanel.tsx';
import { FormulaPanel } from './FormulaPanel.tsx';
import { LivePanel } from './LivePanel.tsx';
import { MediaPanel } from './MediaPanel.tsx';
import type { ActingPanelProps } from './panel-props.ts';
import { QuizPanel } from './QuizPanel.tsx';
import { SlidersPanel } from './SlidersPanel.tsx';
import { SourcesPanel } from './SourcesPanel.tsx';
import { StepsPanel } from './StepsPanel.tsx';
import { TablePanel } from './TablePanel.tsx';
import { TextPanel } from './TextPanel.tsx';
import { TimelinePanel } from './TimelinePanel.tsx';
import { WebPanel } from './WebPanel.tsx';
import { EmailPanel } from './EmailPanel.tsx';

/** One panel of kind `K`. */
type PanelOf<K extends PanelKind> = Extract<Panel, { kind: K }>;

/** Everything the window knows about one panel kind (see the file comment). */
export interface PanelKit<K extends PanelKind> {
  label: string;
  help: string;
  wide: boolean | ((panel: PanelOf<K>) => boolean);
  draw: ComponentType<ActingPanelProps<K>>;
}

/** Every panel kind's kit, in the order of `panel-spec.ts`. */
export const PANELS: { [K in PanelKind]: PanelKit<K> } = {
  text: {
    label: 'Notes',
    help: 'Point at any line to ask about it.',
    wide: true,
    draw: TextPanel,
  },
  table: {
    label: 'Table',
    help: 'Point at a row or a cell to ask about it.',
    wide: true,
    draw: TablePanel,
  },
  steps: {
    label: 'Step by step',
    help: 'Follow it in order; point at a step to go deeper.',
    wide: true,
    draw: StepsPanel,
  },
  formula: {
    label: 'Formula',
    help: 'Point at a symbol to see what it stands for.',
    wide: false,
    draw: FormulaPanel,
  },
  cards: {
    label: 'Ideas',
    help: 'Press a card to open it up.',
    wide: (panel) => panel.cards.length > 2,
    draw: CardsPanel,
  },
  quiz: {
    label: 'Quick check',
    help: 'Pick an answer. Right ones count toward the level.',
    wide: false,
    draw: QuizPanel,
  },
  chart: {
    label: 'Chart',
    help: 'Point at a bar to ask what is behind the number.',
    wide: true,
    draw: ChartPanel,
  },
  files: {
    label: 'Files',
    help: 'Press a file to open it or show it in Finder.',
    wide: true,
    draw: FilesPanel,
  },
  diagram: {
    label: 'Diagram',
    help: 'Point at a box to ask how it connects.',
    wide: true,
    draw: DiagramPanel,
  },
  timeline: {
    label: 'Timeline',
    help: 'In order of time; point at a moment to ask about it.',
    wide: true,
    draw: TimelinePanel,
  },
  folder: {
    label: 'Folder',
    help: 'What is in the folder now; press an entry to open it.',
    wide: true,
    draw: FolderPanel,
  },
  sliders: {
    label: 'What if',
    help: 'Drag a slider and watch the result change.',
    wide: (panel) => panel.variables.length > 2,
    draw: SlidersPanel,
  },
  flashcards: {
    label: 'Practice',
    help: 'Turn a card over, then say whether you knew it.',
    wide: true,
    draw: FlashcardsPanel,
  },
  agenda: {
    label: 'Agenda',
    help: 'Your day in order; point at an entry to ask about it.',
    wide: false,
    draw: AgendaPanel,
  },
  checklist: {
    label: 'Checklist',
    help: 'Tick things off; your ticks are remembered.',
    wide: false,
    draw: ChecklistPanel,
  },
  form: {
    label: 'Fill this in',
    help: 'Fill it in and send it; that becomes your next message.',
    wide: false,
    draw: FormPanel,
  },
  approval: {
    label: 'Plan to approve',
    help: 'Nothing happens until you approve. Read each step first.',
    wide: true,
    draw: ApprovalPanel,
  },
  facts: {
    label: 'What I know',
    help: 'Forget anything that is wrong, or pin what matters most.',
    wide: (panel) => panel.facts.length > 4,
    draw: FactsPanel,
  },
  sources: {
    label: 'Sources',
    help: 'Where the answer came from; press one to read it.',
    wide: false,
    draw: SourcesPanel,
  },
  live: {
    label: 'Live',
    help: 'Readings from this Mac, updating while this is open.',
    wide: false,
    draw: LivePanel,
  },
  media: {
    label: 'Watch',
    help: 'Press play to watch it here.',
    wide: false,
    draw: MediaPanel,
  },
  web: {
    label: 'Visit',
    help: 'Press to open the page in your browser.',
    wide: false,
    draw: WebPanel,
  },
  email: {
    label: 'Email',
    help: 'It is open in your mail app: read it there and press Send.',
    wide: false,
    draw: EmailPanel,
  },
  file: {
    label: 'File',
    help: 'Press to open the file, or show it in Finder.',
    wide: false,
    draw: FilePanel,
  },
  draft: {
    label: 'Draft to save',
    help: 'Check the change, edit it if you like, and Save it yourself.',
    wide: true,
    draw: DraftPanel,
  },
};

/**
 * The kit for this panel's kind, typed to that kind (indexing the mapped type with `K` gives
 * `PanelKit<K>`, so a renderer always gets the panel it was written for).
 */
export function panelKit<K extends PanelKind>(panel: PanelOf<K>): PanelKit<K> {
  return PANELS[panel.kind as K];
}

/** Whether a panel takes the full width of the stage grid (its kit's `wide`). */
export function isWide(panel: Panel): boolean {
  const { wide } = panelKit(panel);
  return typeof wide === 'function' ? wide(panel) : wide;
}
