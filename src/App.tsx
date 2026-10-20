import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ActionBarPrimitive, AssistantRuntimeProvider, ComposerPrimitive, MessagePrimitive,
  ThreadListItemPrimitive, ThreadListPrimitive, ThreadPrimitive, useAuiState, useLocalRuntime,
  type AssistantRuntime,
} from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import { ArrowDown, ArrowUp, Check, Copy, LoaderCircle, MessageSquare, Plus, RotateCcw, Sparkles, Square } from 'lucide-react';
import { InlineOpenUI, ReplayPreferences } from './components/inline-openui';
import { createChatAdapter, messageText } from './lib/chat-adapter';
import { backendLabel, useBackend, type SelectableBackend } from './lib/backend';
import { demoPrompts } from './lib/demo-prompts';
import type { WidgetStateStore } from './lib/widget-state';

const BackendContext = createContext<ReturnType<typeof useBackend> | null>(null);
const useBackendContext = () => useContext(BackendContext)!;
const suggestions = [
  { label: '设计订阅套餐', description: '清晰展示价格与权益', prompt: '生成两张精致的订阅套餐卡片' },
  { label: '生成增长仪表盘', description: '让数据有重点、有层次', prompt: '生成一个包含营收、趋势和设置的仪表盘，使用示例数据' },
  { label: '先聊聊设计', description: '了解支持哪些控件', prompt: '先不要生成控件，介绍你能帮我做什么' },
];

function MarkdownText() {
  return <MarkdownTextPrimitive className="markdown" smooth={false} skipHtml
    components={{ a: ({ children }) => <span>{children}</span>, img: ({ alt }) => <span>{alt || '图片'}</span> }} />;
}
const messageParts = { Text: MarkdownText, data: { by_name: { openui: InlineOpenUI } } };

function WaitingStatus() {
  const { mode } = useBackendContext();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const timer = setInterval(() => setElapsed((value) => value + 1), 1000); return () => clearInterval(timer); }, []);
  return <div className="waiting-status"><LoaderCircle size={15} className="spin" aria-hidden="true" />
    <span role="status">{mode === 'pi' ? '等待 Pi · DeepSeek Flash 回复' : mode === 'codex' ? '等待 Codex CLI 回复' : mode === 'demo' ? '应用本地演示规则' : '等待模型回复'}</span>
    <span className="elapsed" aria-hidden="true">{elapsed} 秒</span>
  </div>;
}

function AssistantMessage() {
  const status = useAuiState((state) => state.message.status);
  const copied = useAuiState((state) => state.message.isCopied);
  const { ready } = useBackendContext();
  const failed = status?.type === 'incomplete' && status.reason === 'error';
  const cancelled = status?.type === 'incomplete' && status.reason === 'cancelled';
  const error = failed && typeof status.error === 'object' && status.error && 'message' in status.error
    ? String(status.error.message) : '生成失败，请稍后重试。';
  return <MessagePrimitive.Root className="chat-message assistant-message" role="article" aria-label="助手回复">
    <div className="message-byline"><span className="assistant-mark"><Sparkles size={14} aria-hidden="true" /></span><strong>myPi Forma</strong><span>让想法成为界面</span></div>
    <div className="message-body"><MessagePrimitive.Parts components={messageParts} />
      {status?.type === 'running' && <WaitingStatus />}
      {failed && <p className="inline-error" role="alert">{error}</p>}
      {cancelled && <p className="cancelled-status">已停止生成，之前的消息和控件保持不变。</p>}
    </div>
    {status?.type !== 'running' && <ActionBarPrimitive.Root className="message-actions">
      {failed || cancelled ? <ActionBarPrimitive.Reload disabled={!ready}><RotateCcw size={14} />重试这条消息</ActionBarPrimitive.Reload>
        : <ActionBarPrimitive.Copy aria-label="复制回复">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? '已复制' : '复制回复'}</ActionBarPrimitive.Copy>}
    </ActionBarPrimitive.Root>}
  </MessagePrimitive.Root>;
}
function UserMessage() {
  return <MessagePrimitive.Root className="chat-message user-message" role="article" aria-label="用户消息">
    <div className="user-bubble"><MessagePrimitive.Parts /></div>
  </MessagePrimitive.Root>;
}
const threadMessages = { UserMessage, AssistantMessage };

function ThreadItem() {
  const running = useAuiState((state) => state.thread.isRunning);
  const title = useAuiState((state) => state.threadListItem.title) || '新对话';
  return <ThreadListItemPrimitive.Root className="thread-item">
    <ThreadListItemPrimitive.Trigger disabled={running} title={title}>
      <MessageSquare size={15} aria-hidden="true" /><span><ThreadListItemPrimitive.Title fallback="新对话" /></span>
    </ThreadListItemPrimitive.Trigger>
  </ThreadListItemPrimitive.Root>;
}

function ChatShell({ runtime }: { runtime: AssistantRuntime }) {
  const backend = useBackendContext();
  const running = useAuiState((state) => state.thread.isRunning);
  const firstUser = useAuiState((state) => {
    const message = state.thread.messages.find((item) => item.role === 'user');
    return message ? messageText(message) : '';
  });
  const threadId = useAuiState((state) => state.threadListItem.id);
  const title = useAuiState((state) => state.threadListItem.title);
  const [motion, setMotion] = useState(true);
  const [seen] = useState(() => new Set<string>());
  const [widgetStates] = useState<WidgetStateStore>(() => new Map());
  const [examplesOpen, setExamplesOpen] = useState(() => window.matchMedia('(min-width: 701px)').matches);
  const exampleUnavailable = !backend.ready || running || backend.mode === 'demo';
  function sendExample(prompt: string) {
    if (exampleUnavailable || runtime.threads.main.getState().isRunning) return;
    // Append directly: do not clear a draft, reset the thread, or substitute a fixed demo response.
    runtime.threads.main.append(prompt);
  }
  useEffect(() => {
    if (firstUser && !title) void runtime.threads.mainItem.rename(firstUser.slice(0, 32)).catch(() => {});
  }, [firstUser, title, threadId, runtime]);
  return <ReplayPreferences.Provider value={{ enabled: motion, seen, widgetStates }}>
    <a className="skip-link" href="#conversation">跳到对话</a>
    <div className="chat-app">
      <aside className="sidebar" aria-label="对话导航">
        <a className="brand" href="/" aria-label="myPi Forma 首页"><span className="brand-mark">f<span>↗</span></span><strong>myPi<span> / Forma</span></strong></a>
        <ThreadListPrimitive.Root className="thread-list">
          <ThreadListPrimitive.New className="new-thread" disabled={running}><Plus size={17} />新建对话</ThreadListPrimitive.New>
          <div className="sidebar-section-label">本次会话</div>
          <div className="thread-items"><ThreadListPrimitive.Items components={{ ThreadListItem: ThreadItem }} /></div>
        </ThreadListPrimitive.Root>
        <details className="sidebar-examples" open={examplesOpen} onToggle={(event) => setExamplesOpen(event.currentTarget.open)}>
          <summary>金融示例<span>点击即发送</span></summary>
          <div className="example-list" role="group" aria-label="金融示例提示">
            {demoPrompts.map((item) => <button type="button" key={item.id} disabled={exampleUnavailable}
              onClick={() => sendExample(item.prompt)}><span>{item.title}<ArrowUp size={13} aria-hidden="true" /></span><small>{item.description}</small></button>)}
          </div>
          <p className="example-note">{backend.mode === 'demo' ? '固定 Demo 不支持金融提示，请用 Pi 或 Codex 服务。' : '假设数据 · 发送到当前对话，调用所选模型并消耗额度。'}</p>
        </details>
        <div className="sidebar-bottom"><span className="sidebar-monogram">◌</span><p>让每一次变化<br />自然地发生。</p><span className="storage-note">对话仅保留在当前页面<br />刷新后会清空</span></div>
      </aside>
      <main className="conversation-main" id="conversation" tabIndex={-1}>
        <header className="chat-header"><div><span className="eyebrow">A CONVERSATION, TAKING SHAPE</span><h1>好控件，聊出来。</h1></div>
          <div className="chat-header-controls">
            {backend.mode !== 'demo' && backend.mode !== 'openai' && <label className="backend-picker">生成后端
              <select aria-label="生成后端" value={backend.selection} disabled={running || backend.mode === 'connecting'}
                onChange={(event) => void backend.refresh(event.target.value as SelectableBackend)}>
                <option value="pi">Pi · DeepSeek Flash</option><option value="codex">Codex CLI</option>
              </select>
            </label>}
            <label className="motion-toggle"><input type="checkbox" checked={motion} onChange={(event) => setMotion(event.target.checked)} />构建动画</label>
          </div>
        </header>
        <ThreadPrimitive.Root className="chat-thread">
          <ThreadPrimitive.Viewport className="thread-viewport" turnAnchor="top" scrollToBottomOnInitialize={false} scrollToBottomOnThreadSwitch={false} aria-label="对话记录">
            <div className="conversation-content" role="log" aria-label="消息" aria-live="polite" aria-relevant="additions">
              <ThreadPrimitive.Empty>
                <section className="welcome"><div className="welcome-symbol"><Sparkles size={25} strokeWidth={1.5} aria-hidden="true" /></div>
                  <span className="eyebrow">FROM A THOUGHT TO SOMETHING REAL</span>
                  <h2>从一个想法，<br /><em>开始一段对话。</em></h2>
                  <p>说说你想做什么。文字、图表与可交互控件，<br className="welcome-break" />都会自然地出现在这里。</p>
                  <div className="suggestions">{suggestions.map((item) => <ThreadPrimitive.Suggestion key={item.label} prompt={item.prompt} send disabled={!backend.ready}>
                    <span>{item.label}<ArrowUp size={14} /></span><small>{item.description}</small>
                  </ThreadPrimitive.Suggestion>)}</div>
                  <p className="welcome-note">assistant-ui 聊天 · OpenUI 控件 · transitions 动画</p>
                </section>
              </ThreadPrimitive.Empty>
              <ThreadPrimitive.Messages components={threadMessages} />
            </div>
          </ThreadPrimitive.Viewport>
          <div className="composer-dock">
            <ThreadPrimitive.ScrollToBottom className="scroll-to-bottom" aria-label="回到最新消息"><ArrowDown size={16} /></ThreadPrimitive.ScrollToBottom>
            {backend.error && <div className="backend-error" role="alert">{backend.error}<button onClick={() => void backend.refresh()}>重新检测</button></div>}
            <ComposerPrimitive.Root className="composer">
              <ComposerPrimitive.Input aria-label="输入消息" placeholder="描述一个控件，或者先聊聊你的想法…" maxLength={2000} rows={2} maxRows={6}
                disabled={!backend.ready} addAttachmentOnPaste={false} submitMode="enter" />
              <div className="composer-bottom"><span className="mode-label"><span className={`status-dot ${backend.mode === 'demo' || !backend.ready ? 'amber' : ''}`} />{backendLabel(backend)}</span>
                {running ? <ComposerPrimitive.Cancel className="send-button" aria-label="停止生成"><Square size={15} /></ComposerPrimitive.Cancel>
                  : <ComposerPrimitive.Send className="send-button" aria-label="发送消息" disabled={!backend.ready}><ArrowUp size={18} /></ComposerPrimitive.Send>}
              </div>
            </ComposerPrimitive.Root>
            <p className="composer-note"><span>Enter 发送 · Shift Enter 换行</span><span>控件在回复中呈现，不会覆盖旧消息。</span></p>
          </div>
        </ThreadPrimitive.Root>
      </main>
    </div>
  </ReplayPreferences.Provider>;
}

export default function App() {
  const backend = useBackend();
  const currentBackend = useRef(backend.mode);
  currentBackend.current = backend.mode;
  const [adapter] = useState(() => createChatAdapter(fetch, () => {
    const mode = currentBackend.current;
    return mode === 'pi' || mode === 'codex' ? mode : undefined;
  }));
  const runtime = useLocalRuntime(adapter);
  return <BackendContext.Provider value={backend}><AssistantRuntimeProvider runtime={runtime}>
    <ChatShell runtime={runtime} />
  </AssistantRuntimeProvider></BackendContext.Provider>;
}
