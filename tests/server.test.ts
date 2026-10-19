import { afterEach, describe, expect, it } from 'vitest';
import { request as httpRequest, type Server } from 'node:http';
import { createApp } from '../server/app';
import { INITIAL_PROGRAM } from '../src/lib/program';

const servers: Server[] = [];
async function start(app = createApp()) {
  const server = app.listen(0, '127.0.0.1'); servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No address');
  return `http://127.0.0.1:${address.port}`;
}
afterEach(async () => { for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); } });
const body = { prompt: '紫色', currentProgram: INITIAL_PROGRAM };
const post = (base: string, data: unknown, headers = {}) => fetch(`${base}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });

describe('local API', () => {
  it('serves truthful demo mode and a validated result', async () => {
    const base = await start();
    expect(await (await fetch(`${base}/api/config`)).json()).toEqual({ mode: 'demo', model: null });
    const response = await post(base, body);
    expect(response.status).toBe(200);
    const data = await response.json(); expect(data.mode).toBe('demo'); expect(data.program).toContain('lavender');
  });
  it('rejects invalid payloads, large bodies and hostile origins', async () => {
    const base = await start();
    expect((await post(base, { prompt: '' })).status).toBe(400);
    expect((await post(base, { ...body, currentProgram: 'bad' })).status).toBe(400);
    expect((await post(base, { prompt: 'a'.repeat(40_000) })).status).toBe(413);
    expect((await post(base, body, { Origin: 'https://evil.example' })).status).toBe(403);
    // Node fetch normalizes Host; use a raw HTTP client for the rebinding check.
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(`${base}/api/config`, { headers: { Host: 'evil.example' } }, (res) => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    expect(status).toBe(403);
  });
  it('validates model output too, and never leaks provider errors', async () => {
    const base = await start(createApp({ apiKey: 'fake-test-secret' }, async () => { throw new Error('fake-test-secret'); }));
    const response = await post(base, body);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('fake-test-secret');
  });
  it('supports a configured model adapter without exposing the key', async () => {
    const base = await start(createApp({ apiKey: 'fake-test-secret', model: 'test-model' }, async () => ({ program: INITIAL_PROGRAM, message: 'ok' })));
    const config = await (await fetch(`${base}/api/config`)).json();
    expect(config).toEqual({ mode: 'live', model: 'test-model' });
    const data = await (await post(base, body)).json(); expect(data.mode).toBe('live');
  });
});
