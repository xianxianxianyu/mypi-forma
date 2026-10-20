import { afterEach, describe, expect, it } from 'vitest';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateWithPi, piArguments, piEnvironment, probePi } from '../server/pi';
import { INITIAL_PROGRAM } from '../src/lib/program';
import { piEvents } from './fixtures/pi-events';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });
async function fakeCLI(code: string) {
  const dir = await mkdtemp(join(tmpdir(), 'mypi-forma-pi-test-')); directories.push(dir);
  const executable = join(dir, 'pi');
  await writeFile(executable, `#!/usr/bin/env node\n${code}`); await chmod(executable, 0o700);
  return { dir, config: { piBin: executable, piAgentDir: dir } };
}
const input = { prompt: '你好', currentProgram: '', history: [] };
const emitText = (text: string, stopReason = 'stop') => `process.stdin.resume();process.stdin.on('end',()=>console.log(${JSON.stringify(piEvents(text, stopReason))}));`;
const emit = (reply: unknown) => emitText(JSON.stringify(reply));

describe('Pi adapter (fake executable only; no inference)', () => {
  it('pins DeepSeek Flash and disables tools, resources, context and persistent sessions', () => {
    const args = piArguments('/tmp/isolated', {});
    for (const flag of ['--print', '--no-session', '--no-tools', '--no-mcp', '--no-extensions', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-context-files', '--no-approve', '--offline']) expect(args).toContain(flag);
    expect(args[args.indexOf('--mode') + 1]).toBe('json');
    expect(args[args.indexOf('--provider') + 1]).toBe('deepseek');
    expect(args[args.indexOf('--model') + 1]).toBe('deepseek-flash');
    const env = piEnvironment('/isolated', { PATH: '/usr/bin', HOME: '/home/test', DEEPSEEK_API_KEY: 'fake-test-secret', OPENAI_API_KEY: 'unrelated', NODE_OPTIONS: 'unsafe', PI_SESSION_FILE: 'parent', ORCA_AGENT_HOOK_TOKEN: 'private', PI_CODING_AGENT_DIR: '/real' });
    expect(env).toEqual({ PATH: '/usr/bin', HOME: '/home/test', DEEPSEEK_API_KEY: 'fake-test-secret', PI_CODING_AGENT_DIR: '/isolated', PI_OFFLINE: '1', PI_SKIP_VERSION_CHECK: '1', PI_TELEMETRY: '0' });
  });
  it('uses isolated stdin/system prompt, reuses only auth/models, and cleans up', async () => {
    const { dir, config } = await fakeCLI(`const fs=require('node:fs');const path=require('node:path');const args=process.argv.slice(2);let stdin='';process.stdin.on('data',b=>stdin+=b);process.stdin.on('end',()=>{fs.writeFileSync(__dirname+'/observed',JSON.stringify({cwd:process.cwd(),args,stdin,agent:process.env.PI_CODING_AGENT_DIR,files:fs.readdirSync(process.env.PI_CODING_AGENT_DIR),authLink:fs.lstatSync(path.join(process.env.PI_CODING_AGENT_DIR,'auth.json')).isSymbolicLink(),instructions:fs.readFileSync(args[args.indexOf('--system-prompt')+1],'utf8')}));console.log(${JSON.stringify(piEvents(JSON.stringify({ message: '你好', program: null })))});});`);
    await writeFile(join(dir, 'auth.json'), '{"deepseek":{"type":"api_key","key":"fake-test-secret"}}');
    await writeFile(join(dir, 'models.json'), '{"providers":{}}');
    await writeFile(join(dir, 'settings.json'), '{"extensions":["unsafe"]}');
    expect(await generateWithPi(input, config, new AbortController().signal)).toEqual({ message: '你好', program: null });
    const observed = JSON.parse(await readFile(join(dir, 'observed'), 'utf8'));
    expect(observed.cwd).not.toBe(process.cwd()); expect(observed.stdin).toContain('你好'); expect(observed.args).not.toContain(input.prompt);
    expect(observed.files.sort()).toEqual(['auth.json', 'models.json']); expect(observed.authLink).toBe(true);
    expect(observed.instructions).toContain('myPi Forma');
    await expect(readFile(join(observed.cwd, 'instructions.txt'))).rejects.toThrow();
    expect(await readFile(join(dir, 'auth.json'), 'utf8')).toContain('fake-test-secret');
  });
  it('accepts complete replies and refuses invalid output without bypassing program validation', async () => {
    const { config } = await fakeCLI(emit({ message: '控件', program: INITIAL_PROGRAM }));
    expect((await generateWithPi(input, config, new AbortController().signal)).program).toBe(INITIAL_PROGRAM);
    for (const reply of [{ message: 'bad', program: 'root = Script("x")' }, { message: '', program: null }]) {
      const fake = await fakeCLI(emit(reply));
      await expect(generateWithPi(input, fake.config, new AbortController().signal)).rejects.toThrow();
    }
    const malformed = await fakeCLI(emitText('```json\n{}\n```'));
    await expect(generateWithPi(input, malformed.config, new AbortController().signal)).rejects.toMatchObject({ code: 'invalid_output' });
  });
  it('normalizes wrapped JSON but refuses truncated or incomplete event streams even with exit code zero', async () => {
    const wrapped = await fakeCLI(emitText('以下是结果：\n```json\n' + JSON.stringify({ message: '你好', program: null }) + '\n```'));
    expect(await generateWithPi(input, wrapped.config, new AbortController().signal)).toEqual({ message: '你好', program: null });
    const truncated = await fakeCLI(emitText('{"message":"partial', 'length'));
    await expect(generateWithPi(input, truncated.config, new AbortController().signal)).rejects.toMatchObject({ code: 'truncated_output' });
    const incomplete = await fakeCLI('console.log(JSON.stringify({type:"agent_start"}));');
    await expect(generateWithPi(input, incomplete.config, new AbortController().signal)).rejects.toMatchObject({ code: 'pi_protocol' });
  });
  it('probes without inference or credential printing and controls failure messages', async () => {
    const ready = await fakeCLI(`const fs=require('node:fs');fs.writeFileSync(__dirname+'/args',JSON.stringify(process.argv.slice(2)));console.log('{"status":"ready"}');`);
    expect(await probePi(ready.config)).toEqual({ ready: true });
    const args = JSON.parse(await readFile(join(ready.dir, 'args'), 'utf8'));
    expect(args.slice(0, 2)).toEqual(['auth', 'check']); expect(args).not.toContain('--credentials'); expect(args).toContain('--no-refresh');
    const bad = await fakeCLI('console.error("401 unauthorized fake-test-secret");process.exit(1);');
    await expect(generateWithPi(input, bad.config, new AbortController().signal)).rejects.toMatchObject({ code: 'pi_auth' });
    expect(await probePi({ ...ready.config, piBin: '/definitely-missing-pi' })).toMatchObject({ ready: false });
  });
  it('aborts and bounds output using the shared process runner', async () => {
    const huge = await fakeCLI('process.stdout.write("x".repeat(4100000));setInterval(()=>{},1000);');
    await expect(generateWithPi(input, huge.config, AbortSignal.timeout(5000))).rejects.toMatchObject({ code: 'output_limit' });
    const hanging = await fakeCLI('setInterval(()=>{},1000);');
    await expect(generateWithPi(input, hanging.config, AbortSignal.timeout(100))).rejects.toMatchObject({ code: 'cancelled' });
  });
});
