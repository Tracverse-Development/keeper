/**
 * Step 5: voice. Asks macOS for the microphone and on-device speech recognition, lets the
 * person pick a system voice and hear it. Skippable: typing always works.
 */
import { useEffect, useState } from 'react';

import { core, EVENTS, on, sentence, type VoiceEvent } from '../../kernel/ipc';
import type { InstallerChoices } from '../InstallerScreen';
import { PanelActions } from '../InstallerScreen';

interface Props {
  choices: InstallerChoices;
  update: (p: Partial<InstallerChoices>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function VoicePanel({ choices, update, onNext, onBack }: Props) {
  const [auth, setAuth] = useState<{ speech: string; mic: boolean; onDevice: boolean } | null>(null);
  const [voices, setVoices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const helper = choices.scan?.voiceHelper ?? false;

  useEffect(
    () =>
      on<VoiceEvent>(EVENTS.voiceEvent, (e) => {
        if (e.type === 'authorized') {
          setAuth(e);
          setAsking(false);
        }
        if (e.type === 'voices') setVoices([...new Set(e.voices.filter((v) => v.language === 'en-US' || v.language === 'en-GB').map((v) => v.name))]);
        if (e.type === 'error') setError(e.message);
      }),
    [],
  );
  useEffect(() => {
    if (helper) core.listVoices().catch((e) => setError(sentence(e)));
  }, [helper]);

  const allow = () => {
    setAsking(true);
    setError(null);
    core.voiceAuthorize().catch((e) => {
      setError(sentence(e));
      setAsking(false);
    });
  };
  const ok = auth?.speech === 'authorized' && auth.mic;

  return (
    <>
      <p className="eyebrow">Voice</p>
      <h2>Talk to {choices.assistantName.trim() || 'Keeper'} out loud.</h2>
      <p className="lead">Speech is recognised on this Mac by Apple's on-device recogniser. Your voice is never sent anywhere.</p>
      {!helper ? (
        <p className="error-line">This build has no voice helper. You can still type.</p>
      ) : (
        <>
          <button type="button" className="btn btn-primary" onClick={allow} disabled={asking || ok}>
            {asking && <span className="spinner" />} {ok ? 'Microphone allowed' : 'Allow microphone and speech'}
          </button>
          {auth && (
            <div className={`status-line ${ok ? 'ok' : 'warn'}`}>
              <span className={`dot ${ok ? 'ok' : 'warn'}`} />
              {ok ? `Ready${auth.onDevice ? ', recognised on this device' : ''}.` : 'Not allowed yet. Open System Settings, Privacy & Security, and allow Keeper for Microphone and Speech Recognition.'}
            </div>
          )}
          <label className="label" htmlFor="voice">
            Voice
          </label>
          <div className="voice-row">
            <select id="voice" className="field" value={choices.voice} onChange={(e) => update({ voice: e.target.value })}>
              {(voices.length ? voices : [choices.voice]).map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <button type="button" className="btn" onClick={() => core.speak(`Hello. I'm ${choices.assistantName.trim() || 'Keeper'}, and I'll remember what matters to you.`).catch((e) => setError(sentence(e)))}>
              Hear it
            </button>
          </div>
          <p className="hint">More natural voices: System Settings, Accessibility, Spoken Content, System voice, Manage Voices (the Premium ones).</p>
        </>
      )}
      {error && <p className="error-line">{error}</p>}
      <PanelActions onBack={onBack} onNext={onNext} nextLabel={ok || !helper ? 'Continue' : 'Skip for now'} />
    </>
  );
}
