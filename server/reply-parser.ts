import { GenerationError, validateReply, type GenerationReply } from './generation';

const invalid = () => new GenerationError('invalid_output', '模型回复不是有效的 JSON 对象。已保留之前的消息，请重试。');

/** Normalize packaging only. Never repair JSON syntax, infer a program, or skip validation. */
export function parseGenerationReply(text: string): GenerationReply {
  if (Buffer.byteLength(text, 'utf8') > 96_000) throw new GenerationError('output_limit', '模型回复过大，已停止处理。');
  const source = text.trim();
  try {
    const value: unknown = JSON.parse(source);
    return validateReply(value);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
  }
  // A single complete fenced payload is unambiguous; content inside must still be strict JSON.
  const fence = /^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i.exec(source);
  if (fence) {
    try { return validateReply(JSON.parse(fence[1])); }
    catch (error) { if (error instanceof GenerationError) throw error; throw invalid(); }
  }
  // Find one top-level object, ignoring braces in JSON strings. Do not salvage a nested
  // object out of a broken array/object, or choose between multiple competing replies.
  let start = -1; let depth = 0; let quoted = false; let escaped = false;
  const candidates: string[] = [];
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (!depth) {
      if (char === '}' || char === ']') throw invalid();
      if (char === '{' || char === '[') { start = i; depth = 1; }
      continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') {
      depth--;
      if (!depth) candidates.push(source.slice(start, i + 1));
    }
  }
  if (depth || candidates.length !== 1) throw invalid();
  let value: unknown;
  try { value = JSON.parse(candidates[0]); } catch { throw invalid(); }
  return validateReply(value);
}
