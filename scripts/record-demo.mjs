// Record the real UI with deterministic demo rules. Never call a live inference backend.
// Requires npm dependencies, Playwright Chromium (or PLAYWRIGHT_CHANNEL),
// `npx playwright install ffmpeg` for video capture, and system ffmpeg for GIF encoding.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'docs', 'assets');
const scratch = await mkdtemp(join(tmpdir(), 'forma-recording-'));
const url = 'http://127.0.0.1:3004';
let server;
let browser;
let context;

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

try {
  // Refuse to attach to somebody else's dev/billed server.
  for (const port of [3004]) {
    let occupied = false;
    try { await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(500) }); occupied = true; } catch {}
    if (occupied) throw new Error(`Port ${port} is already in use; stop that server before recording.`);
  }
  // Record a production build: no development overlays in published screenshots.
  await run('npm', ['run', 'build']);
  server = spawn('npm', ['start'], { cwd: root, detached: process.platform !== 'win32', stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'production', FORMA_BACKEND: 'demo', OPENAI_API_KEY: '', PORT: '3004' } });
  let startError;
  server.on('error', (error) => { startError = error; });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (startError) throw startError;
    if (server.exitCode !== null) throw new Error('Recording dev server exited before becoming ready.');
    try {
      const response = await fetch(`${url}/api/config`, { signal: AbortSignal.timeout(1000) });
      const config = await response.json();
      if (config.mode !== 'demo') throw new Error('Recording requires explicit demo mode.');
      ready = config.ready === true;
    } catch (error) { if (error.message === 'Recording requires explicit demo mode.') throw error; }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('Timed out waiting for the isolated demo server.');
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true });
  context = await browser.newContext({ viewport: { width: 1280, height: 1024 }, reducedMotion: 'no-preference',
    recordVideo: { dir: scratch, size: { width: 1280, height: 1024 } } });
  const page = await context.newPage();
  const video = page.video();
  await page.goto(url);
  await page.getByText('本地演示 · 非 AI', { exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /设计订阅套餐/ }).click();
  await page.getByRole('heading', { name: 'Studio', exact: true }).waitFor();
  await page.waitForTimeout(2300);
  await page.getByRole('button', { name: '选择 Studio', exact: true }).click();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: join(output, 'demo.png') });
  await page.getByRole('button', { name: '重播动画', exact: true }).click();
  await page.waitForTimeout(2500);
  await page.getByLabel('输入消息').pressSequentially('改成中文文案', { delay: 110 });
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page.getByRole('heading', { name: '为好想法，留一点空间。', exact: true }).waitFor();
  await page.waitForTimeout(2700);
  await context.close(); context = undefined;
  const videoPath = await video.path();
  await browser.close(); browser = undefined;
  // One playback, no endless animation. Static screenshot is linked beside the GIF.
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', videoPath,
    '-filter_complex', '[0:v]fps=8,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
    '-loop', '-1', join(output, 'demo.gif')]);
  const bytes = (await stat(join(output, 'demo.gif'))).size;
  console.log(`Recorded docs/assets/demo.gif (${(bytes / 1024 / 1024).toFixed(2)} MiB) and demo.png. No model calls.`);
} finally {
  await context?.close();
  await browser?.close();
  if (server?.pid) {
    if (process.platform === 'win32') await run('taskkill', ['/PID', String(server.pid), '/T', '/F']).catch(() => {});
    else { try { process.kill(-server.pid, 'SIGTERM'); } catch {} }
  }
  await rm(scratch, { recursive: true, force: true });
}
