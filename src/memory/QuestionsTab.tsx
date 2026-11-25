/**
 * The Questions tab: every question this keeper can ask its own Context Graph (the core's
 * catalog, `memory/catalog.rs`), grouped by what it reads. Choosing one shows its inputs; "Ask
 * the graph" runs it through `core.ask` and shows the answer as a table (plain text only) with
 * the row count, the time, the memory layer and the exact SPARQL that ran. A failed ask shows
 * the core's sentence, never an empty table.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { core, sentence, type Answer, type Chat, type QuestionInfo } from '../kernel/ipc';
import { QuestionInputs } from './QuestionInputs';
import { argsProblem, cellText, columns, defaultArgs, groupQuestions, withoutPrefixes } from './questions';
import './memory.css';

interface Props {
  keeper: string;
  open: boolean;
}

export function QuestionsTab({ keeper, open }: Props) {
  const [catalog, setCatalog] = useState<QuestionInfo[] | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [chosen, setChosen] = useState<QuestionInfo | null>(null);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The keeper shown now: answers for a keeper switched away from are dropped.
  const current = useRef(keeper);
  current.current = keeper;

  useEffect(() => {
    core.catalog().then(setCatalog).catch((e) => setError(sentence(e)));
  }, []);

  // Another keeper means another graph: its own chats, and nothing of the last keeper's answer.
  useEffect(() => {
    setChosen(null);
    setAnswer(null);
    setError(null);
  }, [keeper]);
  useEffect(() => {
    if (!open) return;
    core
      .chats(keeper)
      .then((list) => {
        if (current.current !== keeper) return;
        setChats(list);
        // A chat question chosen before the list arrived starts at the most recent chat.
        setArgs((a) => ('chat' in a && !a.chat ? { ...a, chat: list[0]?.id ?? '' } : a));
      })
      .catch((e) => {
        if (current.current === keeper) setError(sentence(e));
      });
  }, [keeper, open]);

  const groups = useMemo(() => groupQuestions(catalog ?? []), [catalog]);

  const choose = (q: QuestionInfo) => {
    setChosen(q);
    setArgs(defaultArgs(q.params, chats[0]?.id));
    setAnswer(null);
    setError(null);
  };

  const problem = chosen ? argsProblem(chosen.params, args) : null;
  const ask = async () => {
    if (!chosen || problem) return;
    setAsking(true);
    setError(null);
    setAnswer(null);
    const asked = keeper;
    try {
      const sent: Record<string, string> = {};
      for (const p of chosen.params) sent[p] = (args[p] ?? '').trim();
      const got = await core.ask(chosen.id, sent, asked);
      if (current.current === asked) setAnswer(got);
    } catch (e) {
      if (current.current === asked) setError(sentence(e));
    } finally {
      setAsking(false);
    }
  };

  if (!catalog) return error ? <p className="error-line">{error}</p> : <span className="spinner" />;

  return (
    <div className="questions">
      <nav className="q-groups" aria-label="Questions">
        {groups.map((g) => (
          <section key={g.group} className="q-group">
            <p className="q-group-name">{g.group}</p>
            <ul>
              {g.questions.map((q) => (
                <li key={q.id}>
                  <button type="button" className={`q-item ${chosen?.id === q.id ? 'is-on' : ''}`} aria-pressed={chosen?.id === q.id} onClick={() => choose(q)}>
                    {q.title}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      {chosen && (
        <section className="q-ask" aria-live="polite">
          <p className="q-title">{chosen.title}</p>
          <QuestionInputs params={chosen.params} args={args} chats={chats} onChange={(patch) => setArgs((a) => ({ ...a, ...patch }))} />
          <button type="button" className="btn btn-primary q-button" onClick={ask} disabled={asking || Boolean(problem)}>
            {asking && <span className="spinner" />} Ask the graph
          </button>
          {problem && <p className="hint">{problem}</p>}
          {error && <p className="error-line">{error}</p>}
          {answer && <AnswerView answer={answer} />}
        </section>
      )}
      {!chosen && error && <p className="error-line">{error}</p>}
    </div>
  );
}

function AnswerView({ answer }: { answer: Answer }) {
  const cols = columns(answer.rows);
  const t = answer.trace;
  return (
    <div className="q-answer">
      <p className="q-meta">
        <span className="dot ok" /> {t.rows} {t.rows === 1 ? 'row' : 'rows'} · {t.ms} ms · {t.layer}
      </p>
      {answer.rows.length === 0 ? (
        <p className="muted small">The graph answered: nothing matches yet.</p>
      ) : (
        <div className="q-table-wrap">
          <table className="q-table">
            <thead>
              <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {answer.rows.map((row, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c} className="selectable" title={row[c]}>
                      {cellText(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <code className="mono selectable q-sparql">{withoutPrefixes(t.sparql)}</code>
    </div>
  );
}
