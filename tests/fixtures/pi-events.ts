export function piEvents(text: string, stopReason = 'stop', aborted = false): string {
  return [
    { type: 'session', version: 3 }, { type: 'agent_start' },
    { type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'ignored intermediate' } },
    { type: 'message_end', message: { role: 'assistant', stopReason, content: [
      { type: 'thinking', thinking: 'not response JSON' }, { type: 'text', text },
    ] } },
    { type: 'agent_end', willRetry: false }, { type: 'agent_settled', aborted },
  ].map((event) => JSON.stringify(event)).join('\n') + '\n';
}
