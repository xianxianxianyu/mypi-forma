import { generationInstructions, GenerationError, type Generator } from './generation';
import { parseGenerationReply } from './reply-parser';

export const generateWithOpenAI: Generator = async (input, config, signal) => {
  if (!config.apiKey) throw new GenerationError('api_key_missing', 'OpenAI 后端未配置 OPENAI_API_KEY。');
  const response = await fetch(`${(config.baseURL || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model || 'gpt-4.1-mini', stream: false, max_tokens: 3500,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: generationInstructions() },
        ...input.history.map((turn) => ({ role: turn.role, content: turn.text })),
        { role: 'user', content: `Latest successful message-owned UI (source only, not unsent local state):\n${input.currentProgram}\n\nRequest:\n${input.prompt}` }] }),
  });
  if (!response.ok) throw new GenerationError('provider_failed', `模型服务返回 HTTP ${response.status}。请检查 OpenAI 配置。`);
  const reader = response.body?.getReader();
  if (!reader) throw new GenerationError('empty_response', '模型返回空响应。');
  let text = ''; let bytes = 0;
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 256_000) { await reader.cancel(); throw new GenerationError('output_limit', '模型响应过大。'); }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    const payload = JSON.parse(text);
    if (payload?.choices?.[0]?.finish_reason === 'length') throw new GenerationError('truncated_output', '模型输出被截断，请缩小需求范围。');
    if (payload?.choices?.[0]?.finish_reason !== 'stop') throw new GenerationError('incomplete_output', '模型未正常完成回复，未采用部分结果。');
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('no content');
    return parseGenerationReply(content);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError('invalid_output', '模型返回的结构化回复无效，请重试。');
  }
};
