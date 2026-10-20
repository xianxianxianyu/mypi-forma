import { afterEach, describe, expect, it } from 'vitest';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codexArguments, codexEnvironment, generateWithCodex, probeCodex, runCodexProcess } from '../server/codex';
import { codexPrompt } from '../server/generation';
import { INITIAL_PROGRAM } from '../src/lib/program';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });
async function fakeCLI(code: string) {
  const dir = await mkdtemp(join(tmpdir(), 'forma-codex-test-')); directories.push(dir);
  const executable = join(dir, 'codex');
  await writeFile(executable, `#!/usr/bin/env node\n${code}`); await chmod(executable, 0o700);
  return { dir, executable };
}
const input = { prompt: '请生成紫色指标卡', currentProgram: INITIAL_PROGRAM, history: [] };
const emitReply = (value: unknown, raw = false) => `const fs = require('node:fs'); const args = process.argv.slice(2); let stdin = ''; process.stdin.on('data', b => stdin += b); process.stdin.on('end', () => { fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], ${JSON.stringify(raw ? value : JSON.stringify(value))}); });`;

describe('Codex CLI adapter (fake executable, no model calls)', () => {
  it('uses read-only, tool-disabled, ephemeral invocation with stdin and no shell interpolation', () => {
    const args = codexArguments('/tmp/isolated', { codexModel: 'test-model' });
    expect(args).toContain('--ignore-user-config'); expect(args).toContain('read-only');
    expect(args).toContain('--ephemeral'); expect(args).toContain('shell_tool'); expect(args).toContain('hooks');
    expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox');
    expect(args.at(-1)).toBe('-');
    const env = codexEnvironment({ PATH: '/usr/bin', HOME: '/home/test', CODEX_HOME: '/auth', OPENAI_API_KEY: 'secret', ORCA_AGENT_HOOK_TOKEN: 'secret', GH_TOKEN: 'secret' });
    expect(env).toEqual({ PATH: '/usr/bin', HOME: '/home/test', CODEX_HOME: '/auth' });
    expect(codexPrompt({ ...input, history: [{ role: 'user', text: 'remember violet' }] })).toContain('remember violet');
  });
  it('accepts a real structured final reply and removes its temporary working directory', async () => {
    const { executable, dir } = await fakeCLI(`${emitReply({ message: '更新好了。', program: INITIAL_PROGRAM })}\nprocess.stdin.on('end', () => fs.writeFileSync(__dirname + '/observed', JSON.stringify({ cwd: process.cwd(), args, stdin })));`);
    const result = await generateWithCodex(input, { codexBin: executable }, new AbortController().signal);
    expect(result.program).toBe(INITIAL_PROGRAM);
    const observed = JSON.parse(await readFile(join(dir, 'observed'), 'utf8'));
    expect(observed.cwd).not.toBe(process.cwd());
    expect(observed.stdin).toContain(input.prompt);
    expect(observed.args).not.toContain(input.prompt);
    expect(observed.args).toContain('--output-schema');
    await expect(readFile(join(observed.cwd, 'reply.json'))).rejects.toThrow();
  });
  it('supports chat-only replies without updating the canvas', async () => {
    const { executable } = await fakeCLI(emitReply({ message: '你之前选择了紫色。', program: null }));
    expect(await generateWithCodex(input, { codexBin: executable }, new AbortController().signal)).toEqual({ message: '你之前选择了紫色。', program: null });
  });
  it('normalizes fenced replies without relaxing the output schema or program validation', async () => {
    const reply = { message: '控件', program: INITIAL_PROGRAM };
    const { executable } = await fakeCLI(emitReply('```json\n' + JSON.stringify(reply) + '\n```', true));
    expect(await generateWithCodex(input, { codexBin: executable }, new AbortController().signal)).toEqual(reply);
  });
  it('rejects invalid programs and malformed structured output', async () => {
    for (const reply of [{ message: 'bad', program: 'root = Script("x")' }, { message: '', program: null }, { program: null }]) {
      const { executable } = await fakeCLI(emitReply(reply));
      await expect(generateWithCodex(input, { codexBin: executable }, new AbortController().signal)).rejects.toThrow();
    }
  });
  it('reports missing executables and authentication errors without leaking stderr', async () => {
    expect(await probeCodex({ codexBin: '/definitely-missing-forma-codex' })).toMatchObject({ ready: false });
    const { executable } = await fakeCLI('console.error("unauthorized 401 fake-test-secret"); process.exit(1);');
    await expect(generateWithCodex(input, { codexBin: executable }, new AbortController().signal)).rejects.toMatchObject({ code: 'codex_auth', safeMessage: 'Codex 认证失效，请执行 codex login 后重试。' });
  });
  it('kills an aborting process even when SIGTERM is ignored', async () => {
    const { executable, dir } = await fakeCLI(`require('node:fs').writeFileSync(__dirname + '/pid', String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);`);
    const controller = new AbortController();
    const pending = runCodexProcess(executable, [], { signal: controller.signal });
    // Attach the rejection assertion before aborting to avoid an unhandled rejection.
    const rejected = expect(pending).rejects.toMatchObject({ code: 'cancelled' });
    await expect.poll(async () => Number(await readFile(join(dir, 'pid'), 'utf8').catch(() => '0'))).toBeGreaterThan(0);
    const pid = Number(await readFile(join(dir, 'pid'), 'utf8'));
    controller.abort(); await rejected;
    expect(() => process.kill(pid, 0)).toThrow();
  });
  it('limits stdout/stderr and honors an already-aborted signal', async () => {
    const { executable } = await fakeCLI('process.stdout.write("x".repeat(20000)); setInterval(() => {}, 1000);');
    await expect(runCodexProcess(executable, [], { signal: AbortSignal.timeout(3000), maxBytes: 100 })).rejects.toMatchObject({ code: 'output_limit' });
    await expect(runCodexProcess(executable, [], { signal: AbortSignal.abort() })).rejects.toMatchObject({ code: 'cancelled' });
  });
});
