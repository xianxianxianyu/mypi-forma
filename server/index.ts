import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { configFromEnv } from './generation';

const config = configFromEnv(process.env);
const app = createApp(config);
if (process.env.NODE_ENV === 'production') {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.sendFile(`${dist}index.html`));
}
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, '127.0.0.1', () => console.log(`myPi Forma API · http://127.0.0.1:${port} · ${config.backend}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  app.locals.abortGenerations();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2500).unref();
});
