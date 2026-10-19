import express from 'express';
import { library } from '../src/components/library';
import { createDemoProgram, INITIAL_PROGRAM, validateProgram } from '../src/lib/program';
import { requestSchema, type GenerateRequest } from '../src/lib/schemas';

export interface ModelConfig { apiKey?: string; baseURL?: string; model?: string }

export async function generateWithModel(input: GenerateRequest, config: ModelConfig, signal: AbortSignal) {
  const system = library.prompt({
    preamble: 'You are Forma Replay, a meticulous product interface designer. Return only a complete OpenUI Lang program.',
    additionalRules: [
      'Use only Showcase, MetricCard, ActivityChart, PlanCard, PreferenceCard. No HTML, JavaScript, CSS, tools, Query, Mutation, actions, expressions, state variables, or markdown.',
      'Use literal strings, numbers, arrays, and component references only. Return root first and every referenced statement. No orphan statements. Maximum six widgets.',
      'Keep statement names and widget ids stable when editing. Preserve unrelated content. Write concise, thoughtful copy in the language requested.',
      'Prefer clear hierarchy, honest labels, and 1–2 accent colors. Do not invent claims of live data. Pricing and chart values are demo data unless supplied.',
      'Chart values and labels must have matching lengths (3–12). Never embed URLs. All interactions are local preview controls.',
    ], examples: [INITIAL_PROGRAM],
  });
  const response = await fetch(`${(config.baseURL || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model || 'gpt-4.1-mini', stream: false, max_tokens: 3000,
      messages: [{ role: 'system', content: system },
        ...(input.currentProgram ? [{ role: 'assistant', content: input.currentProgram }] : []),
        { role: 'user', content: input.prompt }] }),
  });
  if (!response.ok) throw new Error(`模型服务返回 HTTP ${response.status}。请检查服务端配置。`);
  // Bound upstream output before parsing it. Provider errors/bodies never reach the client.
  const reader = response.body?.getReader();
  if (!reader) throw new Error('模型返回空响应。');
  let text = ''; let bytes = 0;
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 256_000) { await reader.cancel(); throw new Error('模型响应过大。'); }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  const payload = JSON.parse(text);
  const content = payload?.choices?.[0]?.message?.content;
  if (payload?.choices?.[0]?.finish_reason === 'length') throw new Error('模型输出被截断，请缩小需求范围。');
  if (typeof content !== 'string') throw new Error('模型没有返回控件描述。');
  const program = content.trim().replace(/^```(?:openui|openui-lang)?\s*\n/i, '').replace(/\n```$/, '');
  validateProgram(program);
  return { program, message: '新版本已生成并通过控件契约校验。变化区域将重新播放构建动画。' };
}

export function createApp(config: ModelConfig = {}, generator = generateWithModel) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', (req, res, next) => {
    const host = req.hostname;
    const origin = req.get('origin');
    const local = (value: string) => ['localhost', '127.0.0.1', '[::1]'].includes(value);
    let validOrigin = !origin;
    try { if (origin) validOrigin = local(new URL(origin).hostname); } catch { validOrigin = false; }
    if (!local(host) || !validOrigin) { res.status(403).json({ error: '此 Demo 仅允许本机访问。' }); return; }
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/config', (_req, res) => res.json({ mode: config.apiKey ? 'live' : 'demo', model: config.apiKey ? config.model || 'gpt-4.1-mini' : null }));
  let active = 0;
  app.post('/api/generate', async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: '请求格式无效，描述需在 1–2000 字符内。' }); return; }
    if (active >= 2) { res.status(429).json({ error: '生成任务繁忙，请稍后重试。' }); return; }
    try { if (parsed.data.currentProgram) validateProgram(parsed.data.currentProgram); }
    catch { res.status(400).json({ error: '当前控件描述无效，请恢复初始示例。' }); return; }
    active++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnect);
    try {
      const result = config.apiKey ? await generator(parsed.data, config, controller.signal) : createDemoProgram(parsed.data.prompt, parsed.data.currentProgram);
      validateProgram(result.program);
      if (!res.destroyed) res.json({ ...result, mode: config.apiKey ? 'live' : 'demo' });
    } catch (error) {
      // Never serialize provider payloads, credentials or stack traces.
      const message = controller.signal.aborted ? '生成超时或已取消，请重试。' : '生成失败或控件校验未通过。请检查模型配置或简化需求后重试。';
      if (!res.destroyed) res.status(502).json({ error: message });
      if (process.env.NODE_ENV !== 'test') console.warn('[generation]', error instanceof Error ? error.name : 'Error');
    } finally { active--; clearTimeout(timer); res.off('close', disconnect); }
  });
  app.use((error: { type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: '请求体过大或 JSON 格式无效。' });
  });
  return app;
}
