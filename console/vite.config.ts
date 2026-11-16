import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `--mode pages` builds the hosted demo for GitHub Pages under /proofline/.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'pages' ? '/proofline/' : '/',
  build: { outDir: mode === 'pages' ? '../site' : 'dist', emptyOutDir: true },
  server: { proxy: { '/api': 'http://127.0.0.1:4317' } },
}));
