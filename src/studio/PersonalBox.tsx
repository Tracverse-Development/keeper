/**
 * Your own picture on your keeper: a pendant (level 5) and a printed T-shirt (level 8). The
 * picture stays on this computer (a private file in Keeper's folder): never in a shared pack,
 * never in the memory graph, never sent anywhere. Removing it deletes the file.
 */
import { useEffect, useState } from 'react';

import { core, sentence, type PersonalKind, type PersonalPicture, type StudioInfo } from '../kernel/ipc';

const ITEMS: { kind: PersonalKind; unlock: string; name: string }[] = [
  { kind: 'pendant', unlock: 'photo-pendant', name: 'Pendant with your photo' },
  { kind: 'shirt', unlock: 'photo-shirt', name: 'T-shirt printed with your picture' },
];
const MAX_BYTES = 4 * 1024 * 1024;

/** The file's bytes as base64 (no data-URL prefix). */
function base64Of(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('That picture could not be read.'));
    reader.readAsDataURL(file);
  });
}

export function PersonalBox({ info, keeper, onChanged }: { info: StudioInfo; keeper: string; onChanged: (pictures: PersonalPicture[]) => void }) {
  const [pictures, setPictures] = useState<PersonalPicture[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    core.personalList(keeper).then(setPictures).catch(() => setPictures([]));
  }, [keeper]);

  const done = (p: PersonalPicture[]) => {
    setPictures(p);
    setError(null);
    onChanged(p);
  };
  const choose = async (kind: PersonalKind, file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) return setError('That picture is too big (4 MB at most).');
    try {
      done(await core.personalSet(keeper, kind, await base64Of(file)));
    } catch (e) {
      setError(sentence(e));
    }
  };

  return (
    <div className="studio-design">
      <p className="eyebrow">Your own picture</p>
      <p className="muted small">Stays on this computer. Never shared in a pack, never sent anywhere.</p>
      {ITEMS.map((item) => {
        const level = info.unlocks.find((u) => u.id === item.unlock)?.level ?? 0;
        const open = info.experience.unlocked.some((u) => u.id === item.unlock);
        const picture = pictures.find((p) => p.kind === item.kind);
        return (
          <div key={item.kind} className="studio-personal">
            {picture ? <img src={picture.dataUrl} alt="" className="studio-personal-thumb" /> : <span className="studio-personal-thumb is-empty" aria-hidden="true" />}
            <span className="studio-personal-name">{item.name}</span>
            {!open ? (
              <span className="muted small">Unlocks at level {level}</span>
            ) : (
              <>
                <label className="btn btn-small">
                  {picture ? 'Change' : 'Choose a picture'}
                  <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => void choose(item.kind, e.target.files?.[0])} />
                </label>
                {picture && (
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => core.personalRemove(keeper, item.kind).then(done).catch((e) => setError(sentence(e)))}>
                    Remove
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
      {error && <p className="error-line small">{error}</p>}
    </div>
  );
}
