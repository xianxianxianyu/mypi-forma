import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@openuidev/devtools': fileURLToPath(new URL('./src/lib/openui-devtools.ts', import.meta.url)) } },
  server: { port: Number(process.env.VITE_PORT || 5173), strictPort: true, proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT || 3001}` } },
  test: { include: ['tests/**/*.test.ts'] },
});
