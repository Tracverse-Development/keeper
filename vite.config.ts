import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The window is served by Tauri in production (dist/) and by Vite on :5191 in development.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { host: '127.0.0.1', port: 5191, strictPort: true },
  build: { target: 'safari16', chunkSizeWarningLimit: 1200 },
});
