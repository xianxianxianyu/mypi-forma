import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

const configSchema = z.object({
  mode: z.enum(['pi', 'codex', 'openai', 'demo']), model: z.string().nullable(), ready: z.boolean(), error: z.string().optional(),
});
export type SelectableBackend = 'codex' | 'pi';
export type BackendState = { mode: 'pi' | 'codex' | 'openai' | 'demo' | 'connecting' | 'offline'; model: string | null; ready: boolean; error?: string };
export function backendLabel(state: BackendState): string {
  if (state.mode === 'codex') return `Codex CLI${state.model ? ` · ${state.model}` : ''}${state.ready ? '' : ' · 未就绪'}`;
  if (state.mode === 'pi') return `Pi · ${!state.model || state.model === 'deepseek-flash' ? 'DeepSeek Flash' : state.model}${state.ready ? '' : ' · 未就绪'}`;
  if (state.mode === 'openai') return `OpenAI · ${state.model || '未配置'}`;
  if (state.mode === 'demo') return '本地演示 · 非 AI';
  return state.mode === 'offline' ? '服务未连接' : '检测后端…';
}
export function useBackend() {
  const [state, setState] = useState<BackendState>({ mode: 'connecting', model: null, ready: false });
  const [selection, setSelection] = useState<SelectableBackend>('pi');
  const selected = useRef<SelectableBackend | undefined>(undefined);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async (choice?: SelectableBackend) => {
    if (choice) { selected.current = choice; setSelection(choice); }
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setState({ mode: 'connecting', model: null, ready: false });
    try {
      const response = await fetch(`/api/config${selected.current ? `?backend=${selected.current}` : ''}`, { signal: controller.signal });
      if (!response.ok) throw new Error();
      const data = configSchema.parse(await response.json());
      if (!controller.signal.aborted) {
        if (data.mode === 'pi' || data.mode === 'codex') setSelection(data.mode);
        setState(data);
      }
    } catch {
      if (!controller.signal.aborted) setState({ mode: 'offline', model: null, ready: false, error: '后端未连接，请确认 npm run dev 正在运行。' });
    }
  }, []);
  useEffect(() => { void refresh(); return () => request.current?.abort(); }, [refresh]);
  return { ...state, selection, refresh };
}
