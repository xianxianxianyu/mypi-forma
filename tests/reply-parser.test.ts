import { describe, expect, it } from 'vitest';
import { parseGenerationReply } from '../server/reply-parser';
import { piFinalText } from '../server/pi-output';
import { INITIAL_PROGRAM } from '../src/lib/program';
import { piEvents } from './fixtures/pi-events';

const reply = { message: '结果含有 {花括号}、"引号"、\\和换行\n中文', program: INITIAL_PROGRAM };
const json = JSON.stringify(reply);
describe('shared JSON reply normalization', () => {
  it.each([json, ` \ufeff${json}\n`, `\`\`\`json\n${json}\n\`\`\``, `\`\`\`JSON\r\n${json}\r\n\`\`\``, `以下是结果：\n${json}\n以上是说明。`, `结果如下：\n\`\`\`json\n${json}\n\`\`\`\n结束。`])('accepts a complete unambiguous JSON envelope: %#', (source) => {
    expect(parseGenerationReply(source)).toEqual(reply);
  });
  it.each([
    '', 'not JSON', '{"message":"cut off', json + '\n' + json, `[${json}]`,
    '{"wrapper":' + json, `{"wrapper":${json}}`, `[{"broken":${json}`, json + '\n{unfinished',
    '{"message":"x","program":null,}', '```json\n' + json + ',\n```',
    '{"message":"x","program":null,"extra":1}',
    '{"message":"x","program":{"root":"Text"}}',
  ])('rejects malformed, ambiguous or wrong-shape replies: %#', (source) => {
    expect(() => parseGenerationReply(source)).toThrow();
  });
  it('always applies the existing program policy after removing wrappers', () => {
    expect(() => parseGenerationReply('说明\n' + JSON.stringify({ message: '坏程序', program: 'root = Script("x")' }))).toThrow(expect.objectContaining({ code: 'invalid_program' }));
    expect(() => parseGenerationReply('x'.repeat(96001))).toThrow(expect.objectContaining({ code: 'output_limit' }));
  });
});

describe('Pi final message protocol', () => {
  it('uses only authoritative final text, excludes thinking/deltas and supports Unicode separators', () => {
    const text = JSON.stringify({ message: '中文\u2028分隔\u2029文本', program: null });
    expect(piFinalText(piEvents(text).replaceAll('\n', '\r\n'))).toBe(text);
    const lines = [
      { type: 'agent_start' },
      { type: 'message_end', message: { role: 'assistant', stopReason: 'error', content: [] } },
      { type: 'agent_end', willRetry: true },
    ].map((event) => JSON.stringify(event)).join('\n');
    expect(piFinalText(lines + '\n' + piEvents(json))).toBe(json);
  });
  it.each([
    ['length', 'truncated_output'], ['aborted', 'cancelled'], ['error', 'pi_failed'],
    ['toolUse', 'pi_protocol'], ['pending', 'pi_protocol'],
  ])('rejects final stop reason %s', (reason, code) => {
    expect(() => piFinalText(piEvents(json, reason))).toThrow(expect.objectContaining({ code }));
  });
  it.each([['401 unauthorized fake-test-secret', 'pi_auth'], ['429 quota fake-test-secret', 'pi_quota']])('classifies provider failure without exposing it', (detail, code) => {
    const stream = [
      { type: 'message_end', message: { role: 'assistant', stopReason: 'error', errorMessage: detail } },
      { type: 'agent_settled', aborted: false },
    ].map((event) => JSON.stringify(event)).join('\n');
    try { piFinalText(stream); throw new Error('expected failure'); }
    catch (error) { expect(error).toMatchObject({ code }); expect(String(error)).not.toContain('fake-test-secret'); }
  });
  it('requires settlement; refuses malformed events, tools and aborted settlement', () => {
    for (const source of ['plain text', '{}', 'null', piEvents(json).replace(/.*agent_settled.*\n/, ''),
      piEvents(json) + '\n' + JSON.stringify({ type: 'message_end', message: {} })]) {
      expect(() => piFinalText(source)).toThrow(expect.objectContaining({ code: 'pi_protocol' }));
    }
    expect(() => piFinalText(piEvents(json, 'stop', true))).toThrow(expect.objectContaining({ code: 'cancelled' }));
    expect(() => piFinalText(JSON.stringify({ type: 'tool_execution_start' }) + '\n' + piEvents(json))).toThrow(expect.objectContaining({ code: 'pi_tools' }));
  });
});
