import { Component, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Renderer } from '@openuidev/react-lang';
import { useAui, useAuiState, type DataMessagePartProps } from '@assistant-ui/react';
import { ArrowDownToLine, Code2, RotateCcw } from 'lucide-react';
import { library } from './library';
import { MotionContext, MotionRegion } from '../lib/motion';
import { validateProgram } from '../lib/program';
import { runLibraryAction } from './intelligent/actions';
import { assertBoundedValue } from './intelligent/limits';
import { demoTools } from './intelligent/demo-data';
import { openUIDataSchema } from '../lib/chat-adapter';
import { WidgetStateContext, type WidgetStateStore } from '../lib/widget-state';

export const ReplayPreferences = createContext({ enabled: true, seen: new Set<string>(), widgetStates: new Map() as WidgetStateStore });

class WidgetBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p role="alert" className="inline-error">这个控件暂时无法显示。请发送修改要求，其他消息仍然保留。</p> : this.props.children;
  }
}

export function InlineOpenUI({ data }: DataMessagePartProps) {
  const aui = useAui();
  const parsed = useMemo(() => openUIDataSchema.safeParse(data), [data]);
  const validation = useMemo(() => {
    try { return parsed.success ? { root: validateProgram(parsed.data.program) } : { root: null }; }
    catch { return { root: null }; }
  }, [parsed]);
  const messageId = useAuiState((state) => state.message.id);
  const { enabled, seen, widgetStates } = useContext(ReplayPreferences);
  const widgetScope = useMemo(() => ({ messageId, store: widgetStates }), [messageId, widgetStates]);
  const signature = `${messageId}:${parsed.success ? parsed.data.program : ''}`;
  const [autoPlay, setAutoPlay] = useState(() => enabled && !seen.has(signature));
  const [replay, setReplay] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const stateKey = `${messageId}:openui-state`;
  const [initialState] = useState(() => widgetStates.get(stateKey) as Record<string, unknown> | undefined);
  const saveState = useCallback((state: Record<string, unknown>) => {
    try { assertBoundedValue(state); widgetStates.set(stateKey, structuredClone(state)); }
    catch { setError('本地状态超过限制，请简化控件。'); }
  }, [stateKey, widgetStates]);
  useEffect(() => { seen.add(signature); }, [seen, signature]);
  useEffect(() => {
    // Re-enabling animation should not replay every historical reply.
    if (!enabled) { setAutoPlay(false); setReplay(0); }
  }, [enabled]);
  if (!parsed.success || !validation.root) return <p role="alert">控件描述无效，请重新生成。</p>;
  const { program, source, model } = parsed.data;
  function download() {
    const url = URL.createObjectURL(new Blob([program], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `mypi-forma-${messageId}.openui`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const renderer = <Renderer response={program} library={library} isStreaming={false}
    initialState={initialState} onStateUpdate={saveState} toolProvider={demoTools}
    onAction={(event) => {
      if (event.type === 'continue_conversation') {
        const text = event.humanFriendlyMessage.slice(0, 2000);
        const composer = aui.thread().composer();
        const existing = composer.getState().text;
        if (existing.trim()) { setFeedback('输入框中已有草稿，请先发送或清空，再使用此操作。'); return; }
        composer.setText(text);
        setFeedback('已填入输入框，请检查后发送。');
        return;
      }
      if (event.type === 'CopyToClipboard') {
        void runLibraryAction(event)?.then((ok) => setFeedback(ok ? '已复制到剪贴板。' : '复制失败，请手动选择文本。')).catch(() => setFeedback('复制失败，请手动选择文本。'));
      }
    }}
    onError={(errors) => { if (errors.length) setError('部分控件无法显示。可以查看源码，或发送修改要求重试。'); }} />;
  return <section className="inline-openui" data-openui-block data-source={source} aria-label="回复中的 OpenUI 控件">
    <div className="inline-widget-label"><span className="status-dot" />{source === 'demo' ? '本地演示控件 · 非 AI' : `${source === 'pi' ? `Pi · ${!model || model === 'deepseek-flash' ? 'DeepSeek Flash' : model}` : source === 'codex' ? 'Codex' : 'OpenAI'} 生成`}<span>OpenUI</span></div>
    <WidgetBoundary><WidgetStateContext.Provider value={widgetScope}>
      <MotionContext.Provider value={{ enabled: enabled && (autoPlay || replay > 0), replay }}>
        {validation.root.typeName === 'Showcase' ? renderer : <div className="intelligent-ui">
          <MotionRegion signature={program}>{renderer}</MotionRegion>
        </div>}
      </MotionContext.Provider>
    </WidgetStateContext.Provider></WidgetBoundary>
    {error && <p className="inline-error" role="alert">{error}</p>}
    {feedback && <p className="widget-feedback" role="status">{feedback}</p>}
    <div className="widget-actions" aria-label="控件操作">
      <button onClick={() => setReplay((value) => value + 1)} disabled={!enabled}><RotateCcw size={14} />重播动画</button>
      <button onClick={() => setShowCode((value) => !value)} aria-expanded={showCode}><Code2 size={14} />{showCode ? '收起源码' : '查看源码'}</button>
      <button onClick={download}><ArrowDownToLine size={14} />导出控件</button>
    </div>
    {showCode && <pre className="openui-source" tabIndex={0} aria-label="OpenUI 源码"><code>{program}</code></pre>}
  </section>;
}
