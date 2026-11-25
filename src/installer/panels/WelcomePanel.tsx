/** Step 1: what Umoja Desk is, in three promises. */
import { PanelActions } from '../InstallerScreen';

const PROMISES = [
  { title: 'It remembers you', body: 'Tell it about your life and it learns. Every memory is a Knowledge Asset on your own OriginTrail DKG node.' },
  { title: 'It stays with you', body: 'Your memory graph lives on this computer, in private working memory. Nothing is shared or published unless you say so.' },
  { title: 'It talks with you', body: 'Speak or type. Your voice is understood on the device, and every answer can show the graph queries behind it.' },
];

export function WelcomePanel({ onNext }: { onNext: () => void }) {
  return (
    <>
      <p className="eyebrow">Welcome</p>
      <h2>A personal assistant that lives in your own knowledge graph.</h2>
      <ul className="promises">
        {PROMISES.map((p, i) => (
          <li key={p.title} style={{ animationDelay: `${120 + i * 110}ms` }}>
            <span className="promise-num">{i + 1}</span>
            <div>
              <strong>{p.title}</strong>
              <p>{p.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <PanelActions onNext={onNext} nextLabel="Begin" />
    </>
  );
}
