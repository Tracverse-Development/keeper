/**
 * The dispatcher: draws a panel with the renderer for its kind. The switch is exhaustive, so a
 * new kind in `panel-spec.ts` fails the typecheck here until it has a renderer.
 */
import type { Panel, PanelAction } from '../panel-spec.ts';
import { AgendaPanel } from './AgendaPanel.tsx';
import { ApprovalPanel } from './ApprovalPanel.tsx';
import { CardsPanel } from './CardsPanel.tsx';
import { ChartPanel } from './ChartPanel.tsx';
import { ChecklistPanel } from './ChecklistPanel.tsx';
import { DiagramPanel } from './DiagramPanel.tsx';
import { FactsPanel } from './FactsPanel.tsx';
import { FilePanel } from './FilePanel.tsx';
import { LivePanel } from './LivePanel.tsx';
import { MediaPanel } from './MediaPanel.tsx';
import { SourcesPanel } from './SourcesPanel.tsx';
import { WebPanel } from './WebPanel.tsx';
import { FilesPanel } from './FilesPanel.tsx';
import { FlashcardsPanel } from './FlashcardsPanel.tsx';
import { FolderPanel } from './FolderPanel.tsx';
import { FormPanel } from './FormPanel.tsx';
import { FormulaPanel } from './FormulaPanel.tsx';
import { QuizPanel } from './QuizPanel.tsx';
import { SlidersPanel } from './SlidersPanel.tsx';
import { StepsPanel } from './StepsPanel.tsx';
import { TablePanel } from './TablePanel.tsx';
import { TextPanel } from './TextPanel.tsx';
import { TimelinePanel } from './TimelinePanel.tsx';

interface Props {
  panel: Panel;
  onPick: (what: string) => void;
  onAction: (a: PanelAction) => void;
}

export function PanelBody({ panel, onPick, onAction }: Props) {
  switch (panel.kind) {
    case 'text': return <TextPanel panel={panel} onPick={onPick} />;
    case 'table': return <TablePanel panel={panel} onPick={onPick} />;
    case 'steps': return <StepsPanel panel={panel} onPick={onPick} />;
    case 'formula': return <FormulaPanel panel={panel} onPick={onPick} />;
    case 'cards': return <CardsPanel panel={panel} onPick={onPick} />;
    case 'quiz': return <QuizPanel panel={panel} onPick={onPick} onAction={onAction} />;
    case 'chart': return <ChartPanel panel={panel} onPick={onPick} />;
    case 'files': return <FilesPanel panel={panel} onPick={onPick} />;
    case 'diagram': return <DiagramPanel panel={panel} onPick={onPick} />;
    case 'timeline': return <TimelinePanel panel={panel} onPick={onPick} />;
    case 'folder': return <FolderPanel panel={panel} onPick={onPick} />;
    case 'sliders': return <SlidersPanel panel={panel} onPick={onPick} />;
    case 'flashcards': return <FlashcardsPanel panel={panel} onPick={onPick} onAction={onAction} />;
    case 'agenda': return <AgendaPanel panel={panel} onPick={onPick} onAction={onAction} />;
    case 'checklist': return <ChecklistPanel panel={panel} onPick={onPick} onAction={onAction} />;
    case 'form': return <FormPanel panel={panel} onPick={onPick} onAction={onAction} />;
    case 'approval': return <ApprovalPanel panel={panel} onPick={onPick} onAction={onAction} />;
    case 'facts': return <FactsPanel panel={panel} onPick={onPick} onAction={onAction} />;
    case 'sources': return <SourcesPanel panel={panel} onPick={onPick} />;
    case 'live': return <LivePanel panel={panel} onPick={onPick} />;
    case 'media': return <MediaPanel panel={panel} onPick={onPick} />;
    case 'web': return <WebPanel panel={panel} onPick={onPick} />;
    case 'file': return <FilePanel panel={panel} onPick={onPick} />;
    default: {
      const unknown: never = panel;
      return unknown;
    }
  }
}
