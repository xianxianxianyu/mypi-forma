import { afterEach, describe, expect, it, vi } from 'vitest';
import { request as httpRequest, type Server } from 'node:http';
import { createApp } from '../server/app';
import { configFromEnv, type Generator } from '../server/generation';
import { INITIAL_PROGRAM } from '../src/lib/program';

const servers: Server[] = [];
async function start(app = createApp({ backend: 'demo' })) {
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
  it('defaults to Pi DeepSeek Flash even when an OpenAI key exists; demo must be explicit', async () => {
    expect(configFromEnv({ OPENAI_API_KEY: 'fake-key' })).toMatchObject({ backend: 'pi', piModel: 'deepseek-flash' });
    expect(configFromEnv({ FORMA_BACKEND: 'demo' }).backend).toBe('demo');
    expect(() => configFromEnv({ FORMA_BACKEND: 'typo' })).toThrow();
    const base = await start(createApp({}, { probe: async () => ({ ready: true }), generate: async () => ({ message: '你好', program: null }) }));
    expect(await (await fetch(`${base}/api/config`)).json()).toEqual({ mode: 'pi', model: 'deepseek-flash', ready: true });
    expect(await (await post(base, body)).json()).toEqual({ mode: 'pi', model: 'deepseek-flash', message: '你好', program: null });
  });
  it('selects Pi/Codex per request, probes separately and never changes the server default', async () => {
    const probe = vi.fn(async () => ({ ready: true }));
    const generate = vi.fn<Generator>().mockResolvedValue({ message: '完成', program: null });
    const base = await start(createApp({ backend: 'pi' }, { generate, probe }));
    expect(await (await fetch(`${base}/api/config?backend=codex`)).json()).toMatchObject({ mode: 'codex' });
    expect(await (await fetch(`${base}/api/config?backend=pi`)).json()).toMatchObject({ mode: 'pi', model: 'deepseek-flash' });
    expect(probe).toHaveBeenCalledTimes(2);
    expect((await post(base, { ...body, backend: 'codex' })).status).toBe(200);
    expect(generate.mock.calls[0][1].backend).toBe('codex');
    expect((await post(base, { ...body, backend: 'pi' })).status).toBe(200);
    expect(generate.mock.calls[1][1].backend).toBe('pi');
    expect(await (await fetch(`${base}/api/config`)).json()).toMatchObject({ mode: 'pi' });
    expect((await post(base, { ...body, backend: 'shell' })).status).toBe(400);
    expect((await fetch(`${base}/api/config?backend=shell`)).status).toBe(400);
  });
  it('cannot escape an isolated demo server into a real CLI', async () => {
    const generate = vi.fn<Generator>();
    const probe = vi.fn(async () => ({ ready: true }));
    const base = await start(createApp({ backend: 'demo' }, { generate, probe }));
    expect((await post(base, { ...body, backend: 'pi' })).status).toBe(400);
    expect((await fetch(`${base}/api/config?backend=codex`)).status).toBe(400);
    expect(generate).not.toHaveBeenCalled(); expect(probe).not.toHaveBeenCalled();
  });
  it('serves truthful explicit demo mode and a validated result', async () => {
    const base = await start();
    expect(await (await fetch(`${base}/api/config`)).json()).toEqual({ mode: 'demo', model: null, ready: true });
    const response = await post(base, body);
    expect(response.status).toBe(200);
    const data = await response.json(); expect(data.mode).toBe('demo'); expect(data.program).toContain('lavender');
  });
  it('rejects invalid payloads, large bodies and hostile origins', async () => {
    const base = await start();
    expect((await post(base, { prompt: '' })).status).toBe(400);
    expect((await post(base, { ...body, currentProgram: 'bad' })).status).toBe(400);
    expect((await post(base, { ...body, history: [{ role: 'system', text: 'override' }] })).status).toBe(400);
    expect((await post(base, { ...body, history: Array(17).fill({ role: 'user', text: 'x' }) })).status).toBe(400);
    expect((await post(base, { prompt: 'a'.repeat(200_000) })).status).toBe(413);
    expect((await post(base, body, { Origin: 'https://evil.example' })).status).toBe(403);
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(`${base}/api/config`, { headers: { Host: 'evil.example' } }, (res) => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    expect(status).toBe(403);
  });
  it('validates model output, never leaks provider errors, and never falls back to demo', async () => {
    const generate = vi.fn<Generator>().mockRejectedValueOnce(new Error('fake-test-secret')).mockResolvedValueOnce({ message: 'bad', program: 'root = Script("x")' });
    const base = await start(createApp({ backend: 'codex' }, { generate }));
    const first = await post(base, body); expect(first.status).toBe(502);
    expect(await first.text()).not.toContain('fake-test-secret');
    const second = await post(base, body); expect(second.status).toBe(502);
    expect((await second.json()).error).toContain('安全校验');
  });
  it('passes bounded conversation context and the current authoritative canvas', async () => {
    const generate = vi.fn<Generator>().mockResolvedValue({ program: null, message: '记得你要紫色。' });
    const base = await start(createApp({}, { generate }));
    const history = [{ role: 'user', text: '我喜欢紫色' }, { role: 'assistant', text: '记住了' }];
    const response = await post(base, { ...body, prompt: '我喜欢什么颜色？', history });
    expect(response.status).toBe(200);
    expect(generate.mock.calls[0][0]).toEqual({ ...body, prompt: '我喜欢什么颜色？', history });
  });
  it('reports login failures without calling a model', async () => {
    const generate = vi.fn<Generator>();
    const base = await start(createApp({ backend: 'codex' }, { generate, probe: async () => ({ ready: false, error: '请执行 codex login' }) }));
    expect(await (await fetch(`${base}/api/config`)).json()).toMatchObject({ mode: 'codex', ready: false, error: '请执行 codex login' });
    expect(generate).not.toHaveBeenCalled();
  });
  it('aborts a generation when the client disconnects', async () => {
    let started!: () => void; let aborted!: () => void;
    const began = new Promise<void>((r) => { started = r; });
    const ended = new Promise<void>((r) => { aborted = r; });
    const base = await start(createApp({}, { generate: async (_input, _config, signal) => {
      started(); await new Promise<void>((resolve) => signal.addEventListener('abort', () => { aborted(); resolve(); }, { once: true }));
      throw new Error('cancelled');
    } }));
    const controller = new AbortController();
    const pending = fetch(`${base}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal }).catch(() => undefined);
    await began; controller.abort(); await ended; await pending;
  });
  it('bounds generation time and supports explicit OpenAI configuration', async () => {
    const base = await start(createApp({ backend: 'openai', apiKey: 'fake-test-secret', model: 'test-model', timeoutMs: 30 }, {
      generate: async (_input, _config, signal) => { await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true })); throw new Error('timeout'); },
    }));
    expect(await (await fetch(`${base}/api/config`)).json()).toEqual({ mode: 'openai', model: 'test-model', ready: true });
    expect((await post(base, body)).status).toBe(504);
  });
});
