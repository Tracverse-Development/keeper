/**
 * The dispatcher: draws a panel with the renderer for its kind. The switch is exhaustive, so a
 * new kind in `panel-spec.ts` fails the typecheck here until it has a renderer.
 */
import type { Panel } from '../panel-spec.ts';
import { CardsPanel } from './CardsPanel.tsx';
import { ChartPanel } from './ChartPanel.tsx';
import { FilesPanel } from './FilesPanel.tsx';
import { FormulaPanel } from './FormulaPanel.tsx';
import { QuizPanel } from './QuizPanel.tsx';
import { StepsPanel } from './StepsPanel.tsx';
import { TablePanel } from './TablePanel.tsx';
import { TextPanel } from './TextPanel.tsx';

export function PanelBody({ panel, onPick }: { panel: Panel; onPick: (what: string) => void }) {
  switch (panel.kind) {
    case 'text': return <TextPanel panel={panel} onPick={onPick} />;
    case 'table': return <TablePanel panel={panel} onPick={onPick} />;
    case 'steps': return <StepsPanel panel={panel} onPick={onPick} />;
    case 'formula': return <FormulaPanel panel={panel} onPick={onPick} />;
    case 'cards': return <CardsPanel panel={panel} onPick={onPick} />;
    case 'quiz': return <QuizPanel panel={panel} onPick={onPick} />;
    case 'chart': return <ChartPanel panel={panel} onPick={onPick} />;
    case 'files': return <FilesPanel panel={panel} onPick={onPick} />;
    default: {
      const unknown: never = panel;
      return unknown;
    }
  }
}
