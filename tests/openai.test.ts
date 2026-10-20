import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateWithOpenAI } from '../server/openai';
import { INITIAL_PROGRAM } from '../src/lib/program';

const input = { prompt: '生成控件', currentProgram: '', history: [] };
const config = { apiKey: 'fake-test-secret' };
afterEach(() => vi.unstubAllGlobals());
function mockReply(content: string, finish = 'stop') {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: finish, message: { content } }] })));
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
describe('OpenAI JSON envelope (mock transport; no inference)', () => {
  it('requests JSON mode and handles fenced responses through the common validator', async () => {
    const reply = { message: '控件', program: INITIAL_PROGRAM };
    const fetcher = mockReply('以下是结果\n```json\n' + JSON.stringify(reply) + '\n```');
    expect(await generateWithOpenAI(input, config, new AbortController().signal)).toEqual(reply);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).response_format).toEqual({ type: 'json_object' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([['length', 'truncated_output'], ['content_filter', 'incomplete_output'], ['tool_calls', 'incomplete_output']])('rejects %s even if content looks complete', async (reason, code) => {
    mockReply(JSON.stringify({ message: 'part', program: null }), reason);
    await expect(generateWithOpenAI(input, config, new AbortController().signal)).rejects.toMatchObject({ code });
  });
  it('does not repair broken JSON or bypass unsafe-program validation', async () => {
    mockReply('```json\n{"message":"未结束');
    await expect(generateWithOpenAI(input, config, new AbortController().signal)).rejects.toMatchObject({ code: 'invalid_output' });
    mockReply(JSON.stringify({ message: 'bad', program: 'root = Script("x")' }));
    await expect(generateWithOpenAI(input, config, new AbortController().signal)).rejects.toMatchObject({ code: 'invalid_program' });
  });
});
