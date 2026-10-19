import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Renderer } from '@openuidev/react-lang';
import { ArrowDownToLine, ArrowUp, Check, ChevronDown, Code2, Command, Layers3, LoaderCircle, MessageSquare, Monitor, Plus, RotateCcw, Sparkles, Square, WandSparkles } from 'lucide-react';
import { library } from './components/library';
import { INITIAL_PROGRAM, validateProgram } from './lib/program';
import { MotionContext } from './lib/motion';

type Message = { role: 'user' | 'assistant'; text: string };
type Version = { program: string; label: string };
const suggestions = [
  { icon: '↗', title: '更新增长数据', prompt: '更新营收和图表数据，展示最新增长' },
  { icon: '◈', title: '设计订阅套餐', prompt: '生成两张精致的订阅套餐卡片' },
  { icon: '◐', title: '换成柔和紫色', prompt: '把指标卡改成柔和的紫色' },
  { icon: '文', title: '换一套中文文案', prompt: '把工作台改成中文文案' },
];

export default function App() {
  const [program, setProgram] = useState(INITIAL_PROGRAM);
  const [versions, setVersions] = useState<Version[]>([{ program: INITIAL_PROGRAM, label: '初始工作台' }]);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: '你好，我是 Forma。描述你想要的控件，我们一起把它打磨得更好。右侧已经准备好一组可交互的示例。' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'connecting' | 'demo' | 'live' | 'offline'>('connecting');
  const [model, setModel] = useState('');
  const [replay, setReplay] = useState(0);
  const [motion, setMotion] = useState(true);
  const [view, setView] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const messageEnd = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/config', { signal: controller.signal }).then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => { setMode(data.mode); setModel(data.model || ''); })
      .catch(() => { if (!controller.signal.aborted) setMode('offline'); });
    return () => { controller.abort(); request.current?.abort(); clearTimeout(copyTimer.current); };
  }, []);
  useEffect(() => { messageEnd.current?.scrollIntoView({ block: 'nearest' }); }, [messages, busy]);

  async function send(prompt: string) {
    if (!prompt.trim()) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const ticket = ++sequence.current;
    setBusy(true); setError(''); setInput(''); setView('preview');
    setMessages((history) => [...history, { role: 'user', text: prompt }]);
    try {
      const response = await fetch('/api/generate', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, currentProgram: program }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '生成失败，请重试。');
      validateProgram(data.program);
      if (ticket !== sequence.current) return;
      setMode(data.mode);
      if (data.program !== program) {
        setProgram(data.program);
        setVersions((history) => [...history, { program: data.program, label: prompt.slice(0, 18) }].slice(-12));
      }
      setMessages((history) => [...history, { role: 'assistant', text: data.message }]);
    } catch (err) {
      if (ticket === sequence.current && !controller.signal.aborted) setError(err instanceof Error ? err.message : '网络不可用，请检查服务。');
    } finally { if (ticket === sequence.current) setBusy(false); }
  }
  function cancel() {
    ++sequence.current; request.current?.abort(); setBusy(false);
    setMessages((history) => [...history, { role: 'assistant', text: '已取消本次生成，保留上一个有效版本。' }]);
  }
  function reset() {
    ++sequence.current; request.current?.abort(); setBusy(false); setError('');
    setProgram(INITIAL_PROGRAM); setVersions([{ program: INITIAL_PROGRAM, label: '初始工作台' }]); setView('preview');
    setMessages([{ role: 'assistant', text: '新的画布，新的可能。想先设计什么？' }]);
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(input); }
  function download() {
    const url = URL.createObjectURL(new Blob([program], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'forma-replay.openui'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(program); setCopied(true); clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 1500); }
    catch { setError('无法访问剪贴板，请使用导出按钮。'); }
  }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="/" aria-label="Forma Replay 首页"><span className="brand-mark">f<span>↗</span></span><strong>forma<span> / replay</span></strong><span className="alpha-badge">LAB 01</span></a>
      <div className="topbar-right"><span className="build-note"><span className="status-dot" /> An idea, taking shape.</span><a className="repo-link" href="https://github.com/xianxianxianyu/forma-replay" target="_blank" rel="noreferrer">GitHub <ArrowUp size={13} /></a><span className="avatar">F</span></div>
    </header>
    <div className="workspace">
      <aside className="chat-panel">
        <div className="chat-panel-top"><div><span className="eyebrow">THE CONVERSATION</span><h1>好控件，聊出来。</h1></div><button className="icon-button" aria-label="新建对话" title="新建对话" onClick={reset}><Plus size={18} /></button></div>
        <div className="session-label"><MessageSquare size={14} /><span>Untitled exploration</span><span className="session-dot" /></div>
        <div className="chat-scroll"><div className="intro-symbol"><WandSparkles size={24} strokeWidth={1.5} /></div>
          <h2 className="intro-title">Less prompting.<br /><span>More possibility.</span></h2><p className="intro-copy">从一个想法开始。生成、调整，然后看着<br className="desktop-break" />每一次变化重新成形。</p>
          <div className="suggestions">{suggestions.map((item) => <button key={item.title} disabled={busy} onClick={() => void send(item.prompt)}><span>{item.icon}</span>{item.title}<ArrowUp size={13} /></button>)}</div>
          <div className="messages" role="log" aria-label="对话记录" aria-live="polite">{messages.map((message, i) => <div className={`message message-${message.role}`} key={i}>{message.role === 'assistant' && <span className="assistant-mark"><Sparkles size={13} /></span>}<p>{message.text}</p></div>)}
            {busy && <div className="generating-message"><LoaderCircle className="spin" size={14} /> 正在构思，完成校验后呈现…</div>}<div ref={messageEnd} />
          </div>
        </div>
        <div className="composer-wrap">{error && <div className="error-message" role="alert">{error}</div>}
          <form className="composer" onSubmit={submit}><label className="sr-only" htmlFor="prompt">描述你想要的控件</label><textarea id="prompt" placeholder="描述你想要的控件，或继续修改…" value={input} maxLength={2000} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy) void send(input); } }} />
            <div className="composer-bottom"><span className="mode-label"><span className={`status-dot ${mode === 'live' ? '' : 'amber'}`} />{mode === 'demo' ? '本地演示 · 非 AI' : mode === 'live' ? model : mode === 'offline' ? 'API 未连接' : '连接中…'}</span>
              {busy ? <button type="button" className="send-button" onClick={cancel} aria-label="停止生成"><Square size={14} /></button> : <button className="send-button" type="submit" disabled={!input.trim() || mode === 'offline' || mode === 'connecting'} aria-label="发送消息"><ArrowUp size={18} /></button>}</div>
          </form><p className="composer-hint"><Command size={11} /> Enter 发送 · Shift Enter 换行<span>{input.length}/2000</span></p>
        </div>
      </aside>
      <main className="preview-panel">
        <div className="preview-toolbar"><div className="view-tabs"><button className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}><Monitor size={15} /> 预览</button><button className={view === 'code' ? 'active' : ''} onClick={() => setView('code')}><Code2 size={15} /> OpenUI</button></div>
          <div className="preview-actions"><label className="version-picker"><Layers3 size={14} /><select aria-label="查看历史版本" value={versions.findIndex((v) => v.program === program)} disabled={busy} onChange={(event) => { setProgram(versions[Number(event.target.value)].program); setView('preview'); }}>{versions.map((version, i) => <option key={i} value={i}>v{ i + 1 } · {version.label}</option>)}</select><ChevronDown size={12} /></label>
            <button className="export-button" onClick={download}><ArrowDownToLine size={14} /><span>导出</span></button></div>
        </div>
        <div className="canvas-meta"><span><span className="status-dot" /> LIVE CANVAS <span className="meta-divider">/</span> {mode === 'live' ? 'MODEL GENERATED' : 'SAMPLE DATA'}</span><span>OpenUI × transitions.dev</span></div>
        <div className="canvas-scroll" hidden={view !== 'preview'}>
          <MotionContext.Provider value={{ enabled: motion && view === 'preview', replay }}>
            <Renderer response={program} library={library} isStreaming={false} onError={(errors) => { if (errors.length) setError('控件呈现失败，请恢复历史版本或新建对话。'); }} />
          </MotionContext.Provider>
          <div className="canvas-footnote"><span className="footnote-line" /><span>Crafted through conversation. Brought to life with motion.</span><span className="footnote-line" /></div>
        </div>
        {view === 'code' && <div className="code-pane"><div><span>OPENUI LANG · 当前有效版本</span><button onClick={() => void copy()}>{copied ? <Check size={14} /> : <Code2 size={14} />}{copied ? '已复制' : '复制代码'}</button></div><pre><code>{program}</code></pre><p>仅渲染注册控件，不执行模型生成的 HTML 或 JavaScript。</p></div>}
        <footer className="motion-toolbar"><div><span className="motion-glyph">◌</span><div><strong>每一次变化，都值得被看见。</strong><span>数据提交后重播 · 不因普通重渲染触发</span></div></div><div className="motion-controls"><label><input type="checkbox" checked={motion} onChange={(event) => setMotion(event.target.checked)} /> 构建动画</label><button onClick={() => { setView('preview'); setReplay((n) => n + 1); }} disabled={!motion}><RotateCcw size={14} /> 重播</button></div></footer>
      </main>
    </div>
  </div>;
}
