import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// /api goes to the local Gemini assistant (server/assistant.py), so the key never reaches the browser.
export default defineConfig({plugins: [react()], server: {host: '127.0.0.1', port: 5192, strictPort: true,
  proxy: {'/api': 'http://127.0.0.1:5193'}}});
