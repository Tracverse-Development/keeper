/**
 * The voice: the Mac's own voices (on the device) or ElevenLabs (reply text goes to ElevenLabs).
 * The ElevenLabs key is handed straight to the core, which keeps it in the Keychain; the window
 * never stores it and never shows it again.
 */
import { useEffect, useState } from 'react';

import { core, EVENTS, on, sentence, type ElevenVoice, type Settings, type SettingsChange, type VoiceEvent } from '../kernel/ipc';

export function VoiceSection({ settings, save }: { settings: Settings; save: (c: SettingsChange) => void }) {
  const [systemVoices, setSystemVoices] = useState<string[]>([]);
  const [eleven, setEleven] = useState<ElevenVoice[]>([]);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    core.listVoices().catch(() => undefined);
    core.elevenVoices().then(setEleven).catch((e) => setError(sentence(e)));
    return on<VoiceEvent>(EVENTS.voiceEvent, (e) => {
      if (e.type === 'voices') setSystemVoices([...new Set(e.voices.filter((v) => v.language.startsWith('en')).map((v) => v.name))]);
    });
  }, []);

  const saveKey = async () => {
    setBusy(true);
    setError(null);
    try {
      const voices = await core.elevenSetKey(key);
      setEleven(voices);
      setKey('');
      if (voices.length && !settings.elevenVoiceId) save({ voiceEngine: 'elevenlabs', elevenVoiceId: voices[0].id });
    } catch (e) {
      setError(sentence(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="section">
      <div className="segmented" role="radiogroup" aria-label="Voice engine">
        <button type="button" role="radio" aria-checked={settings.voiceEngine === 'system'} className={settings.voiceEngine === 'system' ? 'is-on' : ''} onClick={() => save({ voiceEngine: 'system' })}>
          Mac voice
        </button>
        <button type="button" role="radio" aria-checked={settings.voiceEngine === 'elevenlabs'} className={settings.voiceEngine === 'elevenlabs' ? 'is-on' : ''} disabled={eleven.length === 0} onClick={() => save({ voiceEngine: 'elevenlabs' })}>
          ElevenLabs
        </button>
      </div>
      {settings.voiceEngine === 'system' ? (
        <select className="field" value={settings.voice} onChange={(e) => save({ voice: e.target.value })}>
          {(systemVoices.length ? systemVoices : [settings.voice]).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      ) : (
        <select className="field" value={settings.elevenVoiceId} onChange={(e) => save({ elevenVoiceId: e.target.value })}>
          {eleven.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      )}
      <div className="voice-row">
        <input className="field" type="password" placeholder={eleven.length ? 'ElevenLabs key saved in your Keychain' : 'Paste your ElevenLabs API key'} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
        <button type="button" className="btn" onClick={saveKey} disabled={busy || (!key && eleven.length === 0)}>
          {busy ? <span className="spinner" /> : key || eleven.length === 0 ? 'Save key' : 'Remove'}
        </button>
      </div>
      <p className="muted small">With ElevenLabs, the words your assistant says are sent to ElevenLabs to be spoken. Your memory and what you say stay here.</p>
      <button type="button" className="btn btn-ghost" onClick={() => core.speak(`Hello, I'm ${settings.assistantName}. This is how I sound.`).catch((e) => setError(sentence(e)))}>
        Hear it
      </button>
      <label className="toggle">
        <input type="checkbox" checked={settings.alwaysListening} onChange={(e) => save({ alwaysListening: e.target.checked })} />
        <span>
          <strong>Always listening</strong>
          <span className="muted small">Listens on this Mac for “{settings.assistantName}”, then acts on what you say next. Speech is recognised on the device; nothing is stored unless it was meant for {settings.assistantName}.</span>
        </span>
      </label>
      {error && <p className="error-line">{error}</p>}
    </div>
  );
}
