/**
 * Modes: the jobs this keeper can do. Pick a mode to read and edit it: its scope (what it handles;
 * anything else switches mode), its instructions (type them or upload a .md file), the tools it may
 * use (a fixed choice: written instructions can never grant tools), its skills, and the links it
 * trusts. Editing a built-in makes your version (Reset brings Keeper's back); New mode makes your own.
 * Saved to your kit graph on the DKG; the keeper uses it from the next message.
 */
import { useEffect, useState } from 'react';

import { core, sentence, type RoleInfo } from '../kernel/ipc';

const TOOLS: { id: RoleInfo['tools']; name: string; words: string }[] = [
  { id: 'none', name: 'Talk only', words: 'never touches the computer or the web' },
  { id: 'web', name: 'Web', words: 'searches and reads the web' },
  { id: 'look', name: 'Look', words: 'looks at your computer, never changes it' },
  { id: 'act', name: 'Act', words: 'changes your computer, after you approve a plan' },
];

const BLANK: RoleInfo = { id: '', title: '', blurb: '', brief: '', scope: '', tools: 'none', skills: ['ask-memory'], resources: [], builtin: false, edited: false };

export function ModesTab({ onChanged }: { onChanged: () => void }) {
  const [modes, setModes] = useState<RoleInfo[]>([]);
  const [skills, setSkills] = useState<{ name: string; what: string }[]>([]);
  const [draft, setDraft] = useState<RoleInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    core.modesList().then(setModes).catch((e) => setNote(sentence(e)));
    core.skillsList().then(setSkills).catch(() => setSkills([]));
  }, []);

  const set = (patch: Partial<RoleInfo>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const done = (list: RoleInfo[], words: string) => {
    setModes(list);
    setNote(words);
    onChanged();
  };
  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const list = await core.modesSave({ ...draft, id: draft.id || draft.title });
      done(list, `Saved ${draft.title}. Your keeper uses it from the next message.`);
      setDraft(null);
    } catch (e) {
      setNote(sentence(e));
    } finally {
      setBusy(false);
    }
  };
  const reset = async (m: RoleInfo) => {
    setBusy(true);
    try {
      done(await core.modesReset(m.id), m.builtin ? `${m.title} is back to Keeper's version.` : `Deleted ${m.title}.`);
      setDraft(null);
    } catch (e) {
      setNote(sentence(e));
    } finally {
      setBusy(false);
    }
  };
  const upload = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 64 * 1024) return setNote('Instructions files are text, at most 64 KB.');
    void file.text().then((text) => set({ brief: text }));
  };

  if (draft) {
    const known = new Set(draft.skills);
    return (
      <div className="studio-tab mode-edit">
        <label className="field-label">Title<input className="field" value={draft.title} maxLength={40} onChange={(e) => set({ title: e.target.value })} /></label>
        <label className="field-label">What it handles (its scope)
          <input className="field" value={draft.scope} maxLength={300} placeholder="e.g. gardening: plants, soil, pests, what to plant when" onChange={(e) => set({ scope: e.target.value })} />
        </label>
        <label className="field-label">
          <span className="mode-edit-row">Instructions <label className="link small">Upload a .md file<input type="file" accept=".md,.txt,text/markdown,text/plain" hidden onChange={(e) => upload(e.target.files?.[0])} /></label></span>
          <textarea className="field mode-brief" value={draft.brief} maxLength={12000} rows={10} onChange={(e) => set({ brief: e.target.value })} />
        </label>
        <p className="eyebrow">What it may use</p>
        <div className="mode-tools" role="radiogroup" aria-label="Tools">
          {TOOLS.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={draft.tools === t.id} className={`studio-chip ${draft.tools === t.id ? 'is-on' : ''}`} onClick={() => set({ tools: t.id })} title={t.words}>
              {t.name}
            </button>
          ))}
        </div>
        <p className="muted small">{TOOLS.find((t) => t.id === draft.tools)?.words}. Instructions can never give a mode more than this.</p>
        <p className="eyebrow">Skills</p>
        <ul className="mode-skills">
          {skills.map((s) => (
            <li key={s.name}>
              <label>
                <input type="checkbox" checked={known.has(s.name) || known.has('*')} disabled={known.has('*')} onChange={(e) => set({ skills: e.target.checked ? [...draft.skills, s.name] : draft.skills.filter((x) => x !== s.name) })} />
                <strong>{s.name}</strong> <span className="muted small">{s.what.replace(/^\{[^}]*\}\s*/, '')}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="eyebrow">Links it trusts</p>
        {draft.resources.map((r, i) => (
          <div key={i} className="mode-edit-row">
            <input className="field" value={r.title} placeholder="Name" onChange={(e) => set({ resources: draft.resources.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
            <input className="field" value={r.url} placeholder="https://…" onChange={(e) => set({ resources: draft.resources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
            <button type="button" className="link small" onClick={() => set({ resources: draft.resources.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        <button type="button" className="link small" onClick={() => set({ resources: [...draft.resources, { title: '', url: '' }] })}>Add a link</button>
        <div className="mode-edit-row">
          <button type="button" className="btn btn-primary" disabled={busy || !draft.title.trim() || !draft.scope.trim()} onClick={() => void save()}>Save mode</button>
          <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
        </div>
        {note && <p className="muted small">{note}</p>}
      </div>
    );
  }

  return (
    <div className="studio-tab">
      <p className="muted small">Each mode is a job with its own instructions, skills and tools, on the same mind and memory of you. Your keeper switches mode when you ask for something another mode handles.</p>
      <ul className="mode-list">
        {modes.map((m) => (
          <li key={m.id}>
            <button type="button" className="mode-card" onClick={() => setDraft({ ...m })}>
              <strong>{m.title}</strong>
              <span className="muted small">{m.scope}</span>
              <span className="inv-meta">
                <span className="wardrobe-tag">{TOOLS.find((t) => t.id === m.tools)?.name}</span>
                <span className="wardrobe-tag">{m.skills.includes('*') ? 'All skills' : `${m.skills.length} skills`}</span>
                {m.builtin ? <span className="wardrobe-tag">{m.edited ? 'Edited' : 'Keeper'}</span> : <span className="wardrobe-tag">Yours</span>}
              </span>
            </button>
            {(m.edited || !m.builtin) && (
              <button type="button" className="link small" disabled={busy} onClick={() => void reset(m)}>{m.builtin ? 'Reset' : 'Delete'}</button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="btn" onClick={() => setDraft({ ...BLANK })}>New mode</button>
      {note && <p className="muted small">{note}</p>}
    </div>
  );
}
