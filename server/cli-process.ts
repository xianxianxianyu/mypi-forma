import { spawn } from 'node:child_process';
import { GenerationError } from './generation';

export interface CLIProcessOptions {
  cwd?: string;
  input?: string;
  signal: AbortSignal;
  maxBytes?: number;
  env: NodeJS.ProcessEnv;
  backend: 'codex' | 'pi';
}

/** Bounded UTF-8 output, no shell, and abort -> TERM/KILL the POSIX process group. */
export function runCLIProcess(executable: string, args: string[], options: CLIProcessOptions): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    if (options.signal.aborted) { reject(new GenerationError('cancelled', '生成已取消或超时。')); return; }
    const label = options.backend === 'pi' ? 'Pi' : 'Codex';
    const bin = options.backend === 'pi' ? 'PI_BIN' : 'CODEX_BIN';
    const child = spawn(executable, args, { cwd: options.cwd, env: options.env, shell: false,
      detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout: Buffer[] = []; const stderr: Buffer[] = [];
    let bytes = 0; let failure: GenerationError | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const kill = (signal: NodeJS.Signals) => {
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch { /* Already exited. */ }
    };
    const stop = (error: GenerationError) => {
      if (failure || settled) return;
      failure = error; kill('SIGTERM');
      killTimer = setTimeout(() => kill('SIGKILL'), 1000); killTimer.unref();
    };
    const abort = () => stop(new GenerationError('cancelled', '生成已取消或超时。'));
    options.signal.addEventListener('abort', abort, { once: true });
    const collect = (chunks: Buffer[], data: Buffer) => {
      bytes += data.byteLength;
      if (bytes > (options.maxBytes ?? 512_000)) { stop(new GenerationError('output_limit', `${label} 输出过大，已停止本次生成。`)); return; }
      chunks.push(data);
    };
    child.stdout.on('data', (data: Buffer) => collect(stdout, data));
    child.stderr.on('data', (data: Buffer) => collect(stderr, data));
    child.stdin.on('error', () => { /* Process exit is handled below, including EPIPE. */ });
    child.on('error', (error: NodeJS.ErrnoException) => {
      failure = new GenerationError(error.code === 'ENOENT' ? `${options.backend}_missing` : `${options.backend}_start_failed`,
        error.code === 'ENOENT' ? `找不到 ${label} CLI。请安装 ${options.backend}，或在 .env 中设置 ${bin}。` : `无法启动 ${label} CLI，请检查可执行文件权限。`);
    });
    child.on('close', (code) => {
      if (failure) kill('SIGKILL');
      settled = true; clearTimeout(killTimer); options.signal.removeEventListener('abort', abort);
      if (failure) reject(failure);
      else resolve({ code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') });
    });
    if (options.signal.aborted) abort();
    child.stdin.end(options.input || '');
  });
}
