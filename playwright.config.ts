import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  // Never reuse the user's running (potentially billed) Codex/OpenAI server.
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5174/api/config', reuseExistingServer: false, timeout: 60_000,
    env: { FORMA_BACKEND: 'demo', OPENAI_API_KEY: '', PORT: '3002', API_PORT: '3002', VITE_PORT: '5174' } },
});
