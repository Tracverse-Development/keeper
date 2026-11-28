/**
 * Keeper's file viewer as the window sees it: whether it is open, the folder listed, the file
 * previewed, the way back. Opened by the core (`files://show`, from an ability) or by any panel
 * (`openInFiles`). Closes itself when the keeper puts new panels on the Stage, so an answer is
 * never hidden behind it.
 */
import { useEffect, useRef, useState } from 'react';

import { core, EVENTS, on, sentence, type FileListing, type FilePreview } from '../kernel/ipc';

const OPEN_IN_FILES = 'keeper:files';
const FILE_SAVED = 'keeper:file-saved';

/** Opens Keeper's file viewer at a folder or file (from a panel's row, a file card…). */
export function openInFiles(path: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_IN_FILES, { detail: path }));
}

/** Tells the viewer a file was just saved (a draft's Save), so its folder and preview refresh. */
export function fileSaved(path: string): void {
  window.dispatchEvent(new CustomEvent(FILE_SAVED, { detail: path }));
}

export function useFiles(stagePanels: readonly unknown[]) {
  const [listing, setListing] = useState<FileListing | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const history = useRef<string[]>([]);

  const look = (path: string) => {
    setBusy(true);
    setPreview(null);
    core
      .filesPreview(path)
      .then(setPreview)
      .catch((e) => setError(sentence(e)))
      .finally(() => setBusy(false));
  };

  const go = (path: string, remember = true) => {
    setError(null);
    core
      .filesList(path)
      .then((next) => {
        if (remember && listing && listing.path !== next.path) history.current.push(listing.path);
        setListing(next);
        setPreview(null);
        if (next.selected) look(next.selected);
        void core.browserClose().catch(() => undefined);
      })
      .catch((e) => setError(sentence(e)));
  };

  // Listened to ONCE (through a ref to the latest `go`): re-listening on every render left gaps
  // in which an opening sent mid-turn was missed.
  const goLatest = useRef(go);
  goLatest.current = go;
  const savedLatest = useRef((_: string) => {});
  savedLatest.current = (path: string) => {
    if (!listing || !path.startsWith(`${listing.path}/`)) return;
    core.filesList(listing.path).then(setListing).catch(() => undefined);
    if (preview?.path === path) look(path);
  };
  useEffect(() => {
    const opened = (e: Event) => goLatest.current(String((e as CustomEvent<string>).detail));
    window.addEventListener(OPEN_IN_FILES, opened);
    const saved = (e: Event) => savedLatest.current(String((e as CustomEvent<string>).detail));
    window.addEventListener(FILE_SAVED, saved);
    const offCore = on<{ path: string }>(EVENTS.filesShow, (e) => goLatest.current(e.path));
    return () => {
      window.removeEventListener(OPEN_IN_FILES, opened);
      window.removeEventListener(FILE_SAVED, saved);
      offCore();
    };
  }, []);
  // New panels from the keeper close the viewer (an answer is never hidden behind it); a turn
  // that only opened the viewer brings no panels and leaves it open.
  useEffect(() => {
    if (stagePanels.length > 0) setListing(null);
  }, [stagePanels]);

  return {
    // An opening that failed still shows, with its reason (never a silent nothing).
    open: listing !== null || error !== null,
    listing,
    preview,
    error,
    busy,
    go,
    look,
    canGoBack: history.current.length > 0,
    back: () => {
      const previous = history.current.pop();
      if (previous) go(previous, false);
    },
    unpreview: () => setPreview(null),
    close: () => {
      history.current = [];
      setListing(null);
      setPreview(null);
      setError(null);
    },
  };
}

export type Files = ReturnType<typeof useFiles>;
