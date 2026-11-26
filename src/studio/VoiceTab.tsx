/**
 * Voice: this keeper's own voice, or the app-wide one. Every voice can be tested before it is
 * chosen (`voice_try` speaks a sample without saving).
 */
import { useEffect, useState } from 'react';

import { core, EVENTS, on, sentence, type ElevenVoice, type KeeperVoice, type VoiceEvent } from '../kernel/ipc';
import { voiceSample } from './studio-view';

interface Props {
  name: string;
  voice: KeeperVoice | null;
  onVoice: (voice: KeeperVoice | null) => void;
}

export function VoiceTab({ name, voice, onVoice }: Props) {
  const [system, setSystem] = useState<string[]>([]);
  const [eleven, setEleven] = useState<ElevenVoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    core.listVoices().catch(() => undefined);
    core.elevenVoices().then(setEleven).catch(() => setEleven([]));
    return on<VoiceEvent>(EVENTS.voiceEvent, (e) => {
      if (e.type === 'voices') setSystem([...new Set(e.voices.filter((v) => v.language.startsWith('en')).map((v) => v.name))]);
    });
  }, []);

  const test = (v: KeeperVoice) => core.voiceTry(v.engine, v.id, voiceSample(name)).catch((e) => setError(sentence(e)));
  const row = (v: KeeperVoice, label: string) => {
    const on = voice?.engine === v.engine && voice.id === v.id;
    return (
      <li key={`${v.engine}:${v.id}`} className={on ? 'is-on' : ''}>
        <button type="button" className="studio-voice" aria-pressed={on} onClick={() => onVoice(v)}>
          {label}
        </button>
        <button type="button" className="link small" onClick={() => void test(v)}>
          Test
        </button>
      </li>
    );
  };

  return (
    <div className="studio-tab">
      <button type="button" className={`studio-chip ${voice ? '' : 'is-on'}`} onClick={() => onVoice(null)}>
        Use the voice in Settings
      </button>
      {error && <p className="error-line small">{error}</p>}
      {eleven.length > 0 && (
        <>
          <p className="eyebrow">ElevenLabs voices</p>
          <ul className="studio-voices">{eleven.map((v) => row({ engine: 'elevenlabs', id: v.id }, v.name))}</ul>
        </>
      )}
      <p className="eyebrow">Voices on this Mac</p>
      <ul className="studio-voices">{system.map((v) => row({ engine: 'system', id: v }, v))}</ul>
      {eleven.length === 0 && <p className="muted small">Add an ElevenLabs key in Settings for more natural voices.</p>}
    </div>
  );
}
