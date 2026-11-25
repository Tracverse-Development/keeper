/**
 * The window's entry. Two windows load this same page: "main" draws the app, and "talk" (the
 * push-to-talk card the core opens while the keeper button is held) draws only `TalkWindow`.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { windowLabel } from './kernel/ipc';
import { TalkWindow } from './talk/TalkWindow';
import './kernel/app.css';

createRoot(document.getElementById('root')!).render(<StrictMode>{windowLabel() === 'talk' ? <TalkWindow /> : <App />}</StrictMode>);
