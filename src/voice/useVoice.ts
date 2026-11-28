/**
 * The voice as the window sees it: microphone level, the words heard so far, whether it is
 * listening or speaking, and a mouth value for the character (each spoken word opens the
 * mouth; it eases shut between words). Commands heard past the wake word (or by push-to-talk)
 * arrive through `onCommand`.
 */
import { useEffect, useRef, useState } from 'react';

import { core, EVENTS, on, sentence, type VoiceEvent } from '../kernel/ipc';
import { attentionFrom, type Attention } from './attention.ts';

export interface VoiceState {
  level: number;
  partial: string;
  listening: boolean;
  speaking: boolean;
  mouth: number;
  error: string | null;
  /** Woken by its name, or still in conversation after answering (always-listening mode). */
  attention: Attention | null;
}

export function useVoice(onCommand: (text: string, keeper: string) => void) {
  const [state, setState] = useState<VoiceState>({ level: 0, partial: '', listening: false, speaking: false, mouth: 0, error: null, attention: null });
  const mouthTarget = useRef(0);
  const commandRef = useRef(onCommand);
  commandRef.current = onCommand;

  useEffect(() => {
    const offEvents = on<VoiceEvent>(EVENTS.voiceEvent, (e) => {
      switch (e.type) {
        case 'level':
          setState((s) => ({ ...s, level: e.value }));
          break;
        case 'partial':
          setState((s) => ({ ...s, partial: e.text }));
          break;
        case 'final':
          setState((s) => ({ ...s, partial: '' }));
          break;
        case 'listening':
          setState((s) => ({ ...s, listening: e.on, level: e.on ? s.level : 0, partial: e.on ? s.partial : '' }));
          break;
        case 'woken':
          setState((s) => ({ ...s, attention: attentionFrom('woken', Date.now()) }));
          break;
        case 'following':
          setState((s) => ({ ...s, attention: attentionFrom('following', Date.now(), e.seconds) }));
          break;
        case 'speech-start':
          setState((s) => ({ ...s, speaking: true }));
          break;
        case 'word':
          mouthTarget.current = 0.45 + Math.min(0.55, e.length / 12);
          break;
        case 'mouth':
          // ElevenLabs audio: the helper sends the loudness directly.
          mouthTarget.current = Math.max(mouthTarget.current, e.value);
          break;
        case 'speech-end':
          mouthTarget.current = 0;
          setState((s) => ({ ...s, speaking: false, mouth: 0 }));
          break;
        case 'error':
          setState((s) => ({ ...s, error: e.message, listening: false }));
          break;
        case 'stopped':
          setState((s) => ({ ...s, listening: false, speaking: false }));
          break;
      }
    });
    const offCommands = on<{ text: string; keeper: string }>(EVENTS.voiceCommand, (c) => {
      setState((s) => ({ ...s, attention: null }));
      commandRef.current(c.text, c.keeper ?? '');
    });
    return () => {
      offEvents();
      offCommands();
    };
  }, []);

  // The mouth: jump open on a word, ease closed between words (~60 fps while speaking).
  useEffect(() => {
    if (!state.speaking) return;
    let frame = 0;
    const tick = () => {
      mouthTarget.current *= 0.86;
      setState((s) => ({ ...s, mouth: mouthTarget.current }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.speaking]);

  // The attention lapses on its own (the window shows it only while it lasts).
  useEffect(() => {
    if (!state.attention) return;
    const timer = window.setTimeout(() => setState((s) => ({ ...s, attention: null })), Math.max(0, state.attention.until - Date.now()));
    return () => window.clearTimeout(timer);
  }, [state.attention]);

  const fail = (e: unknown) => setState((s) => ({ ...s, error: sentence(e) }));
  return {
    ...state,
    listen: () => {
      setState((s) => ({ ...s, error: null }));
      core.hush().catch(() => undefined);
      core.listenOnce().catch(fail);
    },
    stop: () => core.stopListening().catch(fail),
    speak: (text: string, queue = false) => core.speak(text, queue).catch(fail),
    hush: () => core.hush().catch(fail),
    clearError: () => setState((s) => ({ ...s, error: null })),
  };
}
