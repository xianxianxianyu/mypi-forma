import { access, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runCLIProcess } from './cli-process';
import { codexEnvironment } from './codex';
import { generationInstructions, GenerationError, type BackendStatus, type GenerationConfig, type Generator } from './generation';
import { parseGenerationReply } from './reply-parser';
import { piFailure, piFinalText } from './pi-output';

export function piEnvironment(agentDir: string, env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  // Only the selected provider's environment key is inherited; never the parent Pi session, hooks or other keys.
  const { CODEX_HOME: _codex, ...base } = codexEnvironment(env);
  return { ...base, ...(env.DEEPSEEK_API_KEY ? { DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY } : {}),
    PI_CODING_AGENT_DIR: agentDir, PI_OFFLINE: '1', PI_SKIP_VERSION_CHECK: '1', PI_TELEMETRY: '0' };
}

async function isolatedPi<T>(config: GenerationConfig, action: (directory: string, env: NodeJS.ProcessEnv) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'mypi-forma-pi-'));
  const agentDir = join(directory, 'agent');
  try {
    await mkdir(agentDir, { mode: 0o700 });
    const source = resolve(config.piAgentDir || process.env.PI_CODING_AGENT_DIR || join(homedir(), '.pi', 'agent'));
    // Reuse existing auth/model files without copying credentials. Do not load settings, packages or system prompts.
    for (const name of ['auth.json', 'models.json']) {
      const file = join(source, name);
      try { await access(file); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
      await symlink(file, join(agentDir, name), 'file');
    }
    return await action(directory, piEnvironment(agentDir));
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export function piArguments(directory: string, config: GenerationConfig): string[] {
  return ['--print', '--mode', 'json', '--no-session', '--no-tools', '--no-mcp', '--no-extensions', '--no-skills',
    '--no-prompt-templates', '--no-themes', '--no-context-files', '--no-approve', '--offline',
    '--provider', 'deepseek', '--model', config.piModel || 'deepseek-flash', '--thinking', 'off',
    '--system-prompt', join(directory, 'instructions.txt')];
}

export async function probePi(config: GenerationConfig): Promise<BackendStatus> {
  try {
    return await isolatedPi(config, async (directory, env) => {
      const result = await runCLIProcess(config.piBin || 'pi',
        ['auth', 'check', '--provider', 'deepseek', '--model', config.piModel || 'deepseek-flash', '--json', '--no-refresh'],
        { cwd: directory, env, backend: 'pi', signal: AbortSignal.timeout(8000), maxBytes: 16_000 });
      return result.code === 0 ? { ready: true } : { ready: false, error: 'Pi 的 DeepSeek 认证或模型不可用。请在 Pi 中登录 DeepSeek，并检查 PI_MODEL。' };
    });
  } catch (error) {
    return { ready: false, error: error instanceof GenerationError && error.code === 'pi_missing'
      ? error.safeMessage : 'Pi 状态检查失败，请检查 Pi CLI、认证配置和 PI_AGENT_DIR。' };
  }
}

export const generateWithPi: Generator = async (input, config, signal) => isolatedPi(config, async (directory, env) => {
  await writeFile(join(directory, 'instructions.txt'), generationInstructions(), { mode: 0o600 });
  const result = await runCLIProcess(config.piBin || 'pi', piArguments(directory, config), {
    cwd: directory, env, backend: 'pi', maxBytes: 4_000_000, signal: AbortSignal.any([signal, AbortSignal.timeout(config.timeoutMs ?? 120_000)]),
    input: `<conversation-data>\n${JSON.stringify({ history: input.history, currentProgram: input.currentProgram, userMessage: input.prompt })}\n</conversation-data>`,
  });
  if (result.code !== 0) throw piFailure(result.stderr);
  return parseGenerationReply(piFinalText(result.stdout));
});
