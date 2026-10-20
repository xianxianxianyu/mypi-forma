import type { ChatModelAdapter, ChatModelRunResult, ThreadMessage } from '@assistant-ui/react';
import { z } from 'zod';
import { requestSchema, type ChatTurn, type GenerateRequest } from './schemas';
import { validateProgram } from './program';

export const openUIDataSchema = z.object({
  program: z.string().min(1).max(18000),
  source: z.enum(['pi', 'codex', 'openai', 'demo']),
  model: z.string().max(200).optional(),
});
export type OpenUIData = z.infer<typeof openUIDataSchema>;
const responseSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  program: z.string().min(1).max(18000).nullable(),
  mode: z.enum(['pi', 'codex', 'openai', 'demo']),
  model: z.string().max(200).optional(),
});

export function messageText(message: Pick<ThreadMessage, 'content'>): string {
  return message.content.flatMap((part) => part.type === 'text' ? [part.text] : []).join('\n');
}

/** Derive context from the active branch, never from a second global canvas/history store. */
export function buildGenerateRequest(messages: readonly ThreadMessage[]): GenerateRequest {
  const last = messages.at(-1);
  if (!last || last.role !== 'user') throw new Error('没有找到待发送的用户消息。');
  const history: ChatTurn[] = [];
  let pendingUser: string | undefined;
  let currentProgram = '';
  for (const message of messages.slice(0, -1)) {
    if (message.role === 'user') { pendingUser = messageText(message); continue; }
    if (message.role !== 'assistant') continue;
    if (message.status.type === 'complete') {
      const text = messageText(message);
      if (pendingUser && text) history.push({ role: 'user', text: pendingUser }, { role: 'assistant', text });
      for (const part of message.content) {
        if (part.type !== 'data' || part.name !== 'openui') continue;
        const data = openUIDataSchema.safeParse(part.data);
        if (data.success) { validateProgram(data.data.program); currentProgram = data.data.program; }
      }
    }
    // Failed or cancelled turns are not silently presented as successful context.
    pendingUser = undefined;
  }
  return requestSchema.parse({ prompt: messageText(last), history: history.slice(-16), currentProgram });
}

export function responseToMessage(value: unknown): ChatModelRunResult {
  const parsed = responseSchema.safeParse(value);
  if (!parsed.success) throw new Error('回复格式无效，请重试。');
  const { message, program, mode, model } = parsed.data;
  if (program !== null) validateProgram(program);
  return {
    content: [
      { type: 'text', text: message },
      ...(program === null ? [] : [{ type: 'data' as const, name: 'openui', data: { program, source: mode, ...(model ? { model } : {}) } satisfies OpenUIData }]),
    ],
  };
}

/** assistant-ui owns messages, branch selection, run status, aborts and retries. */
export function createChatAdapter(fetcher: typeof fetch = fetch, getBackend: () => 'codex' | 'pi' | undefined = () => undefined): ChatModelAdapter {
  return {
    async run({ messages, abortSignal }) {
      const backend = getBackend();
      const input = { ...buildGenerateRequest(messages), ...(backend ? { backend } : {}) };
      let response: Response;
      try {
        response = await fetcher('/api/generate', { method: 'POST', signal: abortSignal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      } catch (error) {
        if (abortSignal.aborted) throw error;
        throw new Error('无法连接生成服务，请检查网络或本地服务后重试。');
      }
      const payload = await response.json();
      abortSignal.throwIfAborted();
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : '生成失败，请稍后重试。');
      // No artificial token streaming: the CLI currently provides a final validated reply.
      return responseToMessage(payload);
    },
  };
}
