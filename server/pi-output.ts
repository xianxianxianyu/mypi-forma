import { GenerationError } from './generation';

export function piFailure(detail: string): GenerationError {
  if (/not logged|unauthorized|authentication|401|api.?key.*(?:missing|invalid|not)|no api key|expired.*token/i.test(detail)) {
    return new GenerationError('pi_auth', 'Pi 的 DeepSeek 认证不可用，请在 Pi 中登录 DeepSeek 后重试。');
  }
  if (/429|quota|usage.limit|rate.limit/i.test(detail)) return new GenerationError('pi_quota', 'DeepSeek 使用额度或请求频率受限，请稍后重试。');
  return new GenerationError('pi_failed', 'Pi 未能完成生成。请检查 Pi CLI、网络或 PI_MODEL；没有切换到其他后端。');
}

/** Pi JSON mode is a transport protocol, not structured model output. */
export function piFinalText(stdout: string): string {
  const invalid = () => new GenerationError('pi_protocol', 'Pi 未返回完整的完成事件，已保留之前的消息。请检查 Pi CLI 版本或重试。');
  let final: Record<string, unknown> | undefined;
  let settled = false;
  let aborted = false;
  // LF only: U+2028/U+2029 may occur in JSON strings.
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    let event: Record<string, unknown>;
    try { event = JSON.parse(line); } catch { throw invalid(); }
    if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.type !== 'string') throw invalid();
    if (event.type === 'agent_start') { settled = false; final = undefined; }
    if (event.type === 'message_end') {
      if (settled) throw invalid();
      const message = event.message as Record<string, unknown> | undefined;
      if (message?.role === 'assistant') final = message;
    }
    if (event.type === 'agent_settled') {
      if (typeof event.aborted !== 'boolean') throw invalid();
      settled = true; aborted = event.aborted;
    }
    if (event.type.startsWith('tool_execution_')) throw new GenerationError('pi_tools', 'Pi 返回了不允许的工具执行事件，已停止处理。');
  }
  if (!settled) throw invalid();
  if (aborted || final?.stopReason === 'aborted') throw new GenerationError('cancelled', '生成已取消或超时。');
  if (!final) throw invalid();
  if (final.stopReason === 'length') throw new GenerationError('truncated_output', '模型输出达到长度上限，回复不完整，未采用部分结果。');
  if (final.stopReason === 'error') throw piFailure(typeof final.errorMessage === 'string' ? final.errorMessage : '');
  if (final.stopReason !== 'stop' || !Array.isArray(final.content)) throw invalid();
  const texts: string[] = [];
  for (const block of final.content) {
    if (block?.type === 'thinking') continue;
    if (block?.type !== 'text' || typeof block.text !== 'string') throw invalid();
    texts.push(block.text);
  }
  if (!texts.length) throw invalid();
  return texts.join('');
}
