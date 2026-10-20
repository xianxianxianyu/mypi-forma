import express from 'express';
import { createDemoProgram, validateProgram } from '../src/lib/program';
import { requestSchema } from '../src/lib/schemas';
import { generateWithCodex, probeCodex } from './codex';
import { generateWithOpenAI } from './openai';
import { generateWithPi, probePi } from './pi';
import { GenerationError, validateReply, type BackendStatus, type GenerationConfig, type Generator } from './generation';

export function createApp(config: GenerationConfig = {}, dependencies: {
  generate?: Generator;
  probe?: (config: GenerationConfig) => Promise<BackendStatus>;
} = {}) {
  const defaultBackend = config.backend || 'pi';
  const selectable = defaultBackend === 'codex' || defaultBackend === 'pi';
  const resolveBackend = (requested: unknown) => {
    if (requested === undefined) return defaultBackend;
    if (!selectable || (requested !== 'codex' && requested !== 'pi')) return null;
    return requested;
  };
  const generatorFor = (backend: string) => dependencies.generate || (backend === 'pi' ? generateWithPi : backend === 'openai' ? generateWithOpenAI : generateWithCodex);
  const app = express();
  const controllers = new Set<AbortController>();
  app.locals.abortGenerations = () => { for (const controller of controllers) controller.abort(); };
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', (req, res, next) => {
    const origin = req.get('origin');
    const local = (value: string) => ['localhost', '127.0.0.1', '[::1]'].includes(value);
    let validOrigin = !origin;
    try { if (origin) validOrigin = local(new URL(origin).hostname); } catch { validOrigin = false; }
    if (!local(req.hostname) || !validOrigin) { res.status(403).json({ error: '此 Demo 仅允许本机访问。' }); return; }
    next();
  });
  // 16 bounded conversational turns + the current program, including UTF-8 text.
  app.use(express.json({ limit: '192kb' }));
  const statusCache = new Map<string, { at: number; promise: Promise<BackendStatus> }>();
  app.get('/api/config', async (req, res) => {
    const backend = resolveBackend(req.query.backend);
    if (!backend) { res.status(400).json({ error: '不支持的生成后端。演示和 OpenAI 专用服务不允许切换 CLI。' }); return; }
    let status: BackendStatus = { ready: true };
    if (backend === 'codex' || backend === 'pi') {
      let cached = statusCache.get(backend);
      if (!cached || Date.now() - cached.at > 5000) {
        const probe = dependencies.probe || (backend === 'pi' ? probePi : probeCodex);
        cached = { at: Date.now(), promise: probe({ ...config, backend }).catch(() => ({ ready: false, error: '后端状态检查失败，请稍后重试。' })) };
        statusCache.set(backend, cached);
      }
      status = await cached.promise;
    } else if (backend === 'openai' && !config.apiKey) status = { ready: false, error: '请在 .env 中配置 OPENAI_API_KEY。' };
    res.json({ mode: backend, model: backend === 'pi' ? config.piModel || 'deepseek-flash' : backend === 'codex' ? config.codexModel || null : backend === 'openai' ? config.model || 'gpt-4.1-mini' : null, ...status });
  });
  app.post('/api/generate', async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: '请求格式无效：描述需在 1–2000 字符内，历史最多 16 条。' }); return; }
    const backend = resolveBackend(parsed.data.backend);
    if (!backend) { res.status(400).json({ error: '此服务不允许选择该后端。' }); return; }
    if (controllers.size >= 2) { res.status(429).json({ error: '生成任务繁忙，请稍后重试。' }); return; }
    try { if (parsed.data.currentProgram) validateProgram(parsed.data.currentProgram); }
    catch { res.status(400).json({ error: '当前控件描述无效，请新建对话后重试。' }); return; }
    const controller = new AbortController();
    controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 120_000);
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnect);
    try {
      const result = backend === 'demo' ? createDemoProgram(parsed.data.prompt, parsed.data.currentProgram)
        : await generatorFor(backend)(parsed.data, { ...config, backend }, controller.signal);
      const reply = validateReply(result);
      if (!res.destroyed && !controller.signal.aborted) res.json({ ...reply, mode: backend, ...(backend === 'pi' ? { model: config.piModel || 'deepseek-flash' } : {}) });
      else if (!res.destroyed) res.status(504).json({ error: '生成超时，请重试。' });
    } catch (error) {
      // Only controlled messages are public; never return CLI stderr, credentials or provider bodies.
      const message = controller.signal.aborted ? '生成超时或已取消，之前的消息保持不变。'
        : error instanceof GenerationError ? error.safeMessage : '生成失败，请检查后端配置或稍后重试。之前的消息保持不变。';
      if (!res.destroyed) res.status(controller.signal.aborted ? 504 : 502).json({ error: message });
      if (process.env.NODE_ENV !== 'test') console.warn('[generation]', error instanceof GenerationError ? error.code : 'unknown_error');
    } finally { controllers.delete(controller); clearTimeout(timer); res.off('close', disconnect); }
  });
  app.use((error: { type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: '请求体过大或 JSON 格式无效。' });
  });
  return app;
}
