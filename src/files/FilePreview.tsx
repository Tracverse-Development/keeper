/**
 * One file in Keeper's file viewer: a picture, a video or song playing, a text file's words (Edit
 * opens it as a draft, saved only by the person's Save), a document's first page and its words,
 * or what it is. Every file can be handed to the keeper ("Ask {name} about it") or opened in its
 * own app.
 */
import { useState } from 'react';

import { core, localMediaSrc, sentence, type FilePreview as Preview } from '../kernel/ipc';
import type { Panel, PanelAction } from '../kernel/panel-spec';
import { PanelBody } from '../stage/panels/PanelBody';
import { sizeWords } from './files-view.ts';

interface Props {
  preview: Preview | null;
  busy: boolean;
  keeperName: string;
  onClose: () => void;
  onAsk: (text: string) => void;
  onHand: (path: string) => void;
  onAction: (a: PanelAction) => void;
}

export function FilePreview({ preview, busy, keeperName, onClose, onAsk, onHand, onAction }: Props) {
  // The draft belongs to the preview it was opened from: a fresh preview (after a save) shows the new text.
  const [draft, setDraft] = useState<{ of: Preview; panel: Panel } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!preview) return <div className="file-preview"><p className="muted small">Opening…</p></div>;
  const editing = draft?.of === preview ? draft.panel : null;
  const edit = () => core.filesEdit(preview.path).then((panel) => setDraft({ of: preview, panel })).catch((e) => setError(sentence(e)));

  return (
    <div className="file-preview">
      <div className="file-preview-head">
        <strong className="file-preview-name selectable">{preview.name}</strong>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close this file">✕</button>
      </div>
      <div className="file-preview-body">
        {busy && <p className="muted small">Opening…</p>}
        {editing ? (
          <PanelBody panel={editing} onPick={(what) => onAsk(`About ${what}`)} onAction={onAction} />
        ) : (
          <Shown preview={preview} />
        )}
      </div>
      {error && <p className="error-line small">{error}</p>}
      <div className="inv-actions file-preview-actions">
        {preview.kind === 'text' && preview.editable && !editing && <button type="button" className="btn btn-primary btn-small" onClick={() => void edit()}>Edit</button>}
        <button type="button" className="btn btn-small" onClick={() => onHand(preview.path)}>Ask {keeperName} about it</button>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => void core.stageOpen(preview.path, 'open').catch((e) => setError(sentence(e)))}>Open in its app</button>
      </div>
    </div>
  );
}

function Shown({ preview }: { preview: Preview }) {
  switch (preview.kind) {
    case 'picture':
      return <img className="file-picture" src={preview.src} alt={preview.name} />;
    case 'media':
      return preview.video
        ? <video className="file-media" src={localMediaSrc(preview.path)} controls autoPlay playsInline />
        : <audio className="file-audio" src={localMediaSrc(preview.path)} controls autoPlay />;
    case 'text':
      return <pre className="file-text selectable">{preview.text || 'This file is empty.'}</pre>;
    case 'document':
      return (
        <>
          {preview.src && <img className="file-picture is-page" src={preview.src} alt={`The first page of ${preview.name}`} />}
          {preview.text && <pre className="file-text selectable">{preview.text}</pre>}
          {!preview.src && !preview.text && <p className="muted small">I can't show this document here; open it in its app.</p>}
        </>
      );
    case 'other':
      return <p className="muted small">{sizeWords(preview.size)}. I can't show this kind of file inside Keeper; open it in its app.</p>;
  }
}
