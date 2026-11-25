/**
 * Step 2: the DKG node. Umoja Desk uses a node already on this computer when there is one;
 * otherwise it installs its own (pinned version, its own folder, automatic updates off).
 */
import { useEffect, useState } from 'react';

import { core, EVENTS, on, sentence } from '../../kernel/ipc';
import type { InstallerChoices } from '../InstallerScreen';
import { PanelActions } from '../InstallerScreen';
import { nodeFinding } from '../steps';

interface Props {
  choices: InstallerChoices;
  update: (p: Partial<InstallerChoices>) => void;
  rescan: () => Promise<unknown>;
  onNext: () => void;
  onBack: () => void;
}

export function NodePanel({ choices, update, rescan, onNext, onBack }: Props) {
  const [installing, setInstalling] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scan = choices.scan;

  useEffect(() => on<{ line: string }>(EVENTS.setupProgress, (p) => setLines((l) => [...l, p.line])), []);

  const install = async () => {
    setInstalling(true);
    setError(null);
    setLines([]);
    try {
      update({ node: await core.installNode() });
    } catch (e) {
      setError(sentence(e));
    } finally {
      setInstalling(false);
    }
  };

  if (!scan) {
    return (
      <>
        <p className="eyebrow">Memory node</p>
        <h2>Looking for a DKG node on this computer…</h2>
        <div className="scanning">
          <span className="spinner" /> Checking for an OriginTrail DKG V10 node
        </div>
        <PanelActions onBack={onBack} onNext={onNext} canNext={false} />
      </>
    );
  }

  const node = choices.node;
  const finding = node ? 'found' : nodeFinding(scan);
  return (
    <>
      <p className="eyebrow">Memory node</p>
      {finding === 'found' && node ? (
        <>
          <h2>Found your DKG node.</h2>
          <p className="lead">Umoja will keep its memory here, in a private graph only this node can read.</p>
          <dl className="facts-grid">
            <dt>Node</dt>
            <dd>{node.status.name}</dd>
            <dt>Version</dt>
            <dd>OriginTrail DKG {node.status.version}</dd>
            <dt>Network</dt>
            <dd>{node.status.networkName || 'local'}</dd>
            <dt>Address</dt>
            <dd className="mono">127.0.0.1:{node.port}</dd>
            <dt>Folder</dt>
            <dd className="mono selectable">{node.home}</dd>
          </dl>
          <div className="status-line ok">
            <span className="dot ok" /> Answering and signed in
          </div>
        </>
      ) : finding === 'stopped' ? (
        <>
          <h2>Your DKG node is installed but not running.</h2>
          <p className="lead">Start it (for example with <span className="mono">dkg start</span>), then check again. Umoja Desk never starts or changes a node it did not install.</p>
          <button type="button" className="btn" onClick={() => rescan()}>
            Check again
          </button>
        </>
      ) : (
        <>
          <h2>Let's give your assistant a memory node.</h2>
          <p className="lead">There's no DKG node on this computer yet. Umoja Desk will install an edge node in its own folder, pinned to a tested version, with automatic updates off. It needs Node.js.</p>
          <button type="button" className="btn btn-primary" onClick={install} disabled={installing}>
            {installing && <span className="spinner" />} Install a DKG node
          </button>
          {lines.length > 0 && (
            <ul className="log">
              {lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && <p className="error-line">{error}</p>}
      <PanelActions onBack={onBack} onNext={onNext} canNext={Boolean(node)} nextLabel="Use this node" />
    </>
  );
}
