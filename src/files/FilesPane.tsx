/**
 * Keeper's file viewer in the Stage area: a toolbar (Back, Up, the folder as crumbs to press,
 * Show in Finder, Close), the folder's entries (newest first) and, when a file is pressed, its
 * preview beside them (`FilePreview`). Everything stays inside Keeper; the Finder only on request.
 */
import { core } from '../kernel/ipc';
import type { PanelAction } from '../kernel/panel-spec';
import { Icon } from '../stage/icons.tsx';
import { crumbs, fewCrumbs, sizeWords, whenWords } from './files-view.ts';
import { FilePreview } from './FilePreview';
import type { Files } from './useFiles';

interface Props {
  files: Files;
  keeperName: string;
  /** Ask the keeper something (a question about a file). */
  onAsk: (text: string) => void;
  /** Hand a file to the keeper to read with the next message. */
  onHand: (path: string) => void;
  onAction: (a: PanelAction) => void;
}

export function FilesPane({ files, keeperName, onAsk, onHand, onAction }: Props) {
  const { listing, preview } = files;
  if (!listing) {
    return (
      <section className="files-pane" aria-label="Your files">
        <div className="browser-bar files-bar">
          <p className="error-line small files-crumbs">{files.error}</p>
          <button type="button" className="btn btn-ghost btn-icon" onClick={files.close} aria-label="Close your files">✕</button>
        </div>
      </section>
    );
  }
  return (
    <section className={`files-pane ${preview || files.busy ? 'has-preview' : ''}`} aria-label="Your files">
      <div className="browser-bar files-bar">
        <button type="button" className="btn btn-ghost btn-icon" disabled={!files.canGoBack} onClick={files.back} aria-label="Back">‹</button>
        <button type="button" className="btn btn-ghost btn-icon" disabled={!listing.parent} onClick={() => listing.parent && files.go(listing.parent)} aria-label="Up one folder">↑</button>
        <nav className="files-crumbs" aria-label="Folder">
          {fewCrumbs(crumbs(listing.shown, listing.path), preview || files.busy ? 2 : 3).map((c, i, all) => (
            <button key={c.path} type="button" className={`files-crumb ${i === all.length - 1 ? 'is-here' : ''}`} onClick={() => files.go(c.path)}>{c.label}</button>
          ))}
        </nav>
        <button type="button" className="btn btn-small" onClick={() => void core.stageOpen(preview?.path ?? listing.path, preview ? 'reveal' : 'open')}>Show in Finder</button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={files.close} aria-label="Close your files">✕</button>
      </div>
      {files.error && <p className="error-line small">{files.error}</p>}
      <div className="files-body">
        <ul className="files-list" aria-label={`In ${listing.shown}`}>
          {listing.entries.length === 0 && <li className="muted small files-empty">This folder is empty.</li>}
          {listing.entries.map((entry) => (
            <li key={entry.path}>
              <button
                type="button"
                className={`files-entry ${preview?.path === entry.path ? 'is-open' : ''}`}
                onClick={() => (entry.folder ? files.go(entry.path) : files.look(entry.path))}
              >
                <span className={`entry-icon is-${entry.folder ? 'folder' : 'file'}`}><Icon name={entry.folder ? 'folder' : 'file'} size={16} /></span>
                <span className="files-name">{entry.name}</span>
                <span className="files-meta muted small">{entry.folder ? 'Folder' : sizeWords(entry.size)} · {whenWords(entry.modified)}</span>
              </button>
            </li>
          ))}
          {listing.total > listing.entries.length && <li className="muted small files-empty">And {listing.total - listing.entries.length} older items.</li>}
        </ul>
        {(preview || files.busy) && (
          <FilePreview preview={preview} busy={files.busy} keeperName={keeperName} onClose={files.unpreview} onAsk={onAsk} onHand={onHand} onAction={onAction} />
        )}
      </div>
    </section>
  );
}
