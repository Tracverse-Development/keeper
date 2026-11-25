/**
 * Step 3: your keeper. Names keeper #1, the System Administration keeper, and gives it its own
 * memory: creates a curated Context Graph on the node, writes the keeper's profile as the first
 * Knowledge Asset, then reads it back with SPARQL: the round trip is shown, not assumed.
 */
import { useState } from 'react';

import { core, sentence } from '../../kernel/ipc';
import type { InstallerChoices } from '../InstallerScreen';
import { PanelActions } from '../InstallerScreen';
import { shortId, validName } from '../steps';

interface Props {
  choices: InstallerChoices;
  update: (p: Partial<InstallerChoices>) => void;
  onNext: () => void;
  onBack: () => void;
}

const STAGES = ['Creating your Context Graph', 'Writing your first Knowledge Asset', 'Reading it back with SPARQL'];

export function GraphPanel({ choices, update, onNext, onBack }: Props) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const graph = choices.graph;

  const create = async () => {
    if (!choices.node) return;
    setBusy(true);
    setError(null);
    setStage(0);
    // The stages advance while the one call works, so the person sees what is happening.
    const ticker = window.setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 700);
    try {
      update({ graph: await core.createGraph(choices.node.home, choices.assistantName.trim()) });
      setStage(STAGES.length);
    } catch (e) {
      setError(sentence(e));
      setStage(-1);
    } finally {
      window.clearInterval(ticker);
      setBusy(false);
    }
  };

  return (
    <>
      <p className="eyebrow">Your keeper</p>
      <h2>Name your keeper, and give it a memory.</h2>
      <p className="lead">This is your first keeper, the System Administration keeper: it looks after this computer and its files. It remembers in its own Context Graph on your node. You can add more keepers later.</p>
      <label className="label" htmlFor="assistant-name">
        What should your keeper be called? It answers to this name.
      </label>
      <input
        id="assistant-name"
        className="field"
        value={choices.assistantName}
        maxLength={24}
        disabled={Boolean(graph) || busy}
        onChange={(e) => update({ assistantName: e.target.value })}
        autoCorrect="off"
        spellCheck={false}
      />
      {!graph && (
        <button type="button" className="btn btn-primary create-graph" onClick={create} disabled={busy || !validName(choices.assistantName)}>
          {busy && <span className="spinner" />} Create my memory graph
        </button>
      )}
      {stage >= 0 && (
        <ul className="stages">
          {STAGES.map((s, i) => (
            <li key={s} className={stage > i ? 'is-done' : stage === i ? 'is-active' : ''}>
              <span className="stage-tick">{stage > i ? '✓' : ''}</span>
              {s}
            </li>
          ))}
        </ul>
      )}
      {graph && (
        <dl className="facts-grid reveal">
          <dt>Graph</dt>
          <dd className="mono selectable">{graph.graphId}</dd>
          <dt>Asset</dt>
          <dd className="mono selectable" title={graph.profileUal}>
            {shortId(graph.profileUal)}
          </dd>
          <dt>Merkle root</dt>
          <dd className="mono" title={graph.merkleRoot}>
            {shortId(graph.merkleRoot, 10)}
          </dd>
          <dt>Read back</dt>
          <dd>{graph.verified ? `Verified in ${graph.queryMs} ms from working memory` : 'Written, but the read-back did not match'}</dd>
        </dl>
      )}
      {error && <p className="error-line">{error}</p>}
      <PanelActions onBack={onBack} onNext={onNext} canNext={Boolean(graph)} />
    </>
  );
}
