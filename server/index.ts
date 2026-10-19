import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';

const app = createApp({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL, model: process.env.OPENAI_MODEL });
if (process.env.NODE_ENV === 'production') {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.sendFile(`${dist}index.html`));
}
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, '127.0.0.1', () => console.log(`Forma Replay API · http://127.0.0.1:${port} · ${process.env.OPENAI_API_KEY ? 'live model' : 'local demo'}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => process.exit(0)));
