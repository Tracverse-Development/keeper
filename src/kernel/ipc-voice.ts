/** What the voice helper tells the window (`voice://event`), one event per line it writes. */
export type VoiceEvent =
  | { type: 'ready'; onDevice: boolean }
  | { type: 'level'; value: number }
  | { type: 'partial'; text: string }
  | { type: 'final'; text: string }
  | { type: 'listening'; on: boolean; mode?: string }
  | { type: 'woken'; keeper?: string }
  | { type: 'following'; keeper?: string; seconds: number }
  | { type: 'speech-start' }
  | { type: 'word'; length: number }
  | { type: 'mouth'; value: number }
  | { type: 'speech-end' }
  | { type: 'authorized'; speech: string; mic: boolean; onDevice: boolean }
  | { type: 'voices'; voices: { name: string; language: string; quality: number }[] }
  | { type: 'stopped' }
  /** `needs`: the permission macOS refused, so the window can open that page of Settings. */
  | { type: 'error'; message: string; needs?: 'speech' | 'microphone' };

/** Keeper's browser: whether a page is open inside Keeper, and its address. */
export interface BrowserState {
  open: boolean;
  url: string;
}
