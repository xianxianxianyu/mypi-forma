import { describe, expect, it, vi } from 'vitest';
import type { ChatModelRunOptions, MessageStatus, ThreadMessage } from '@assistant-ui/react';
import { buildGenerateRequest, createChatAdapter, responseToMessage } from '../src/lib/chat-adapter';
import { INITIAL_PROGRAM } from '../src/lib/program';

function user(text: string): ThreadMessage {
  return { id: text, createdAt: new Date(0), role: 'user', content: [{ type: 'text', text }], attachments: [], metadata: { custom: {} } };
}
function assistant(text: string, program: string | null = null, status: MessageStatus = { type: 'complete', reason: 'stop' }): ThreadMessage {
  return { id: text, createdAt: new Date(0), role: 'assistant', status,
    content: [{ type: 'text', text }, ...(program ? [{ type: 'data' as const, name: 'openui', data: { program, source: 'codex' } }] : [])],
    metadata: { custom: {}, unstable_state: null, unstable_annotations: [], unstable_data: [], steps: [] } };
}
function options(signal = new AbortController().signal): ChatModelRunOptions {
  const message = user('你好');
  return { messages: [message], abortSignal: signal, runConfig: {}, context: {}, unstable_getMessage: () => message };
}

describe('assistant-ui adapter context', () => {
  it('starts without a hidden global canvas and supports ordinary conversation', () => {
    expect(buildGenerateRequest([user('你好')])).toEqual({ prompt: '你好', currentProgram: '', history: [] });
    expect(responseToMessage({ message: '你好！', program: null, mode: 'codex' }).content).toEqual([{ type: 'text', text: '你好！' }]);
  });
  it('keeps the latest successful message-owned program through text-only turns', () => {
    const updated = INITIAL_PROGRAM.replace('$24,680', '$42,000');
    const messages = [user('仪表盘'), assistant('第一版', INITIAL_PROGRAM), user('修改'), assistant('第二版', updated), user('聊聊'), assistant('好的'), user('继续')];
    const before = JSON.stringify(messages);
    const request = buildGenerateRequest(messages);
    expect(request.currentProgram).toBe(updated);
    expect(request.history).toHaveLength(6);
    expect(request.history.at(-1)).toEqual({ role: 'assistant', text: '好的' });
    expect(JSON.stringify(messages)).toBe(before);
  });
  it('omits cancelled/failed exchanges and uses only the supplied active branch', () => {
    const messages = [user('生成'), assistant('保留', INITIAL_PROGRAM), user('失败'), assistant('错误', null, { type: 'incomplete', reason: 'error' }),
      user('取消'), assistant('不应成为上下文', INITIAL_PROGRAM.replace('$24,680', '$99,999'), { type: 'incomplete', reason: 'cancelled' }), user('接着聊')];
    expect(buildGenerateRequest(messages)).toEqual({ prompt: '接着聊', currentProgram: INITIAL_PROGRAM,
      history: [{ role: 'user', text: '生成' }, { role: 'assistant', text: '保留' }] });
    expect(buildGenerateRequest([user('新分支')]).currentProgram).toBe('');
  });
  it('bounds history to eight successful pairs while retaining an older UI as edit context', () => {
    const messages = [user('开始'), assistant('旧控件', INITIAL_PROGRAM)];
    for (let i = 0; i < 10; i++) messages.push(user(`问题${i}`), assistant(`回答${i}`));
    messages.push(user('最新问题'));
    const request = buildGenerateRequest(messages);
    expect(request.history).toHaveLength(16);
    expect(request.history[0]).toEqual({ role: 'user', text: '问题2' });
    expect(request.currentProgram).toBe(INITIAL_PROGRAM);
  });
  it('rejects missing, blank and oversized user messages before a network request', () => {
    for (const messages of [[], [assistant('你好')], [user(' ')], [user('a'.repeat(2001))]]) expect(() => buildGenerateRequest(messages)).toThrow();
  });
  it('validates a complete UI and attaches provenance in a typed data part', () => {
    expect(responseToMessage({ mode: 'demo', message: '示例', program: INITIAL_PROGRAM }).content).toEqual([
      { type: 'text', text: '示例' }, { type: 'data', name: 'openui', data: { program: INITIAL_PROGRAM, source: 'demo' } },
    ]);
    for (const value of [null, { message: ' ', program: null, mode: 'codex' }, { message: 'x', program: 'root = Script("x")', mode: 'codex' }, { message: 'x', program: null, mode: 'pretend-ai' }]) {
      expect(() => responseToMessage(value)).toThrow();
    }
  });
});

describe('assistant-ui transport', () => {
  it('snapshots the selected backend for a run and retains Pi provenance', async () => {
    let selected: 'pi' | 'codex' = 'pi';
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ message: 'Pi 控件', program: INITIAL_PROGRAM, mode: 'pi', model: 'deepseek-flash' })));
    const adapter = createChatAdapter(fetcher, () => selected);
    const result = await adapter.run(options());
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({ backend: 'pi' });
    expect(result).toMatchObject({ content: [{ type: 'text' }, { type: 'data', data: { source: 'pi', model: 'deepseek-flash' } }] });
    selected = 'codex';
    fetcher.mockResolvedValue(new Response(JSON.stringify({ message: 'Codex', program: null, mode: 'codex' })));
    await adapter.run(options());
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toMatchObject({ backend: 'codex' });
  });
  it('forwards the runtime abort signal and does not fabricate progress chunks', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ message: '你好', program: null, mode: 'codex' })));
    const input = options();
    const result = await createChatAdapter(fetcher).run(input);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('/api/generate'); expect(init?.signal).toBe(input.abortSignal);
    expect(JSON.parse(String(init?.body))).toEqual({ prompt: '你好', history: [], currentProgram: '' });
    expect(result).toEqual({ content: [{ type: 'text', text: '你好' }] });
  });
  it('surfaces controlled backend errors without automatic retries or demo substitution', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: '请执行 codex login' }), { status: 502 }));
    await expect(createChatAdapter(fetcher).run(options())).rejects.toThrow('codex login');
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('discards a late final response even if the transport ignores abort', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      controller.abort();
      return new Response(JSON.stringify({ message: '迟到', program: INITIAL_PROGRAM, mode: 'codex' }));
    });
    await expect(createChatAdapter(fetcher).run(options(controller.signal))).rejects.toThrow();
  });
  it('gives a readable offline error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network'));
    await expect(createChatAdapter(fetcher).run(options())).rejects.toThrow('无法连接生成服务');
  });
});
