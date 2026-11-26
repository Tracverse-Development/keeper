/**
 * What a person can DO with each kind of panel, in one short line shown under its title, so no
 * panel is a picture with no way in (founder 2026-11-26: a first panel "doesn't really show
 * anything or explain anything"). One line per kind; a test holds the list complete and plain.
 */
import type { PanelKind } from './panel-spec.ts';

export const PANEL_HELP: Record<PanelKind, string> = {
  text: 'Point at any line to ask about it.',
  table: 'Point at a row or a cell to ask about it.',
  steps: 'Follow it in order; point at a step to go deeper.',
  formula: 'Point at a symbol to see what it stands for.',
  cards: 'Press a card to open it up.',
  quiz: 'Pick an answer. Right ones count toward the level.',
  chart: 'Point at a bar to ask what is behind the number.',
  files: 'Press a file to open it or show it in Finder.',
  diagram: 'Point at a box to ask how it connects.',
  timeline: 'In order of time; point at a moment to ask about it.',
  folder: 'What is in the folder now; press an entry to open it.',
  sliders: 'Drag a slider and watch the result change.',
  flashcards: 'Turn a card over, then say whether you knew it.',
  agenda: 'Your day in order; point at an entry to ask about it.',
  checklist: 'Tick things off; your ticks are remembered.',
  form: 'Fill it in and send it; that becomes your next message.',
  approval: 'Nothing happens until you approve. Read each step first.',
  facts: 'Forget anything that is wrong, or pin what matters most.',
  sources: 'Where the answer came from; press one to read it.',
  live: 'Readings from this Mac, updating while this is open.',
  media: 'Press play to watch it here.',
  web: 'Press to open the page in your browser.',
  file: 'Press to open the file, or show it in Finder.',
};
