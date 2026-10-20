import { runCLIProcess } from './cli-process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codexPrompt, GenerationError, type BackendStatus, type GenerationConfig, type Generator } from './generation';
import { parseGenerationReply } from './reply-parser';

/** Do not pass API keys, Orca hook tokens or unrelated application secrets to a model process. */
export function codexEnvironment(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const names = ['PATH', 'HOME', 'USERPROFILE', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'TMPDIR',
    'LANG', 'LC_ALL', 'CODEX_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME',
    'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy',
    'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS'];
  return Object.fromEntries(names.flatMap((name) => env[name] === undefined ? [] : [[name, env[name]]])) as NodeJS.ProcessEnv;
}

interface ProcessOptions { cwd?: string; input?: string; signal: AbortSignal; maxBytes?: number }
/** shell:false, bounded output, abort -> TERM then KILL entire POSIX process group. */
export function runCodexProcess(executable: string, args: string[], options: ProcessOptions): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return runCLIProcess(executable, args, { ...options, backend: 'codex', env: codexEnvironment() });
}

export function codexArguments(directory: string, config: GenerationConfig): string[] {
  return ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check',
    '--sandbox', 'read-only', '-c', 'approval_policy="never"', '-c', 'project_doc_max_bytes=0',
    '-c', 'web_search="disabled"', '--disable', 'shell_tool', '--disable', 'unified_exec',
    '--disable', 'apps', '--disable', 'multi_agent', '--disable', 'hooks',
    '--cd', directory, '--color', 'never', '--json',
    '--output-schema', join(directory, 'reply-schema.json'), '--output-last-message', join(directory, 'reply.json'),
    ...(config.codexModel ? ['--model', config.codexModel] : []), '-'];
}

const outputSchema = {
  type: 'object', additionalProperties: false, required: ['message', 'program'],
  properties: { message: { type: 'string' }, program: { type: ['string', 'null'] } },
};

export async function probeCodex(config: GenerationConfig): Promise<BackendStatus> {
  try {
    const result = await runCodexProcess(config.codexBin || 'codex', ['login', 'status'], { signal: AbortSignal.timeout(5000), maxBytes: 16_000 });
    if (result.code !== 0) return { ready: false, error: 'Codex 尚未登录或认证不可用。请在运行服务的同一终端环境执行 codex login。' };
    return { ready: true };
  } catch (error) {
    return { ready: false, error: error instanceof GenerationError && error.code === 'codex_missing'
      ? error.safeMessage : 'Codex 状态检查失败或超时。请确认 codex login status 正常后重试。' };
  }
}

export const generateWithCodex: Generator = async (input, config, signal) => {
  const directory = await mkdtemp(join(tmpdir(), 'forma-codex-'));
  try {
    await writeFile(join(directory, 'reply-schema.json'), JSON.stringify(outputSchema), { mode: 0o600 });
    const result = await runCodexProcess(config.codexBin || 'codex', codexArguments(directory, config), {
      cwd: directory, input: codexPrompt(input), signal: AbortSignal.any([signal, AbortSignal.timeout(config.timeoutMs ?? 120_000)]),
    });
    if (result.code !== 0) {
      const detail = `${result.stdout}\n${result.stderr}`;
      if (/not logged|unauthorized|authentication|401|expired.*token/i.test(detail)) throw new GenerationError('codex_auth', 'Codex 认证失效，请执行 codex login 后重试。');
      if (/429|quota|usage.limit|rate.limit/i.test(detail)) throw new GenerationError('codex_quota', 'Codex 使用额度或请求频率受限，请稍后重试。');
      throw new GenerationError('codex_failed', 'Codex 未能完成生成。请检查网络、登录状态或 CODEX_MODEL；没有切换到演示模式。');
    }
    const file = join(directory, 'reply.json');
    let text: string;
    try {
      if ((await stat(file)).size > 96_000) throw new Error('too large');
      text = await readFile(file, 'utf8');
    } catch { throw new GenerationError('codex_no_result', 'Codex 没有返回完整结果，已保留原预览。'); }
    return parseGenerationReply(text);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
