# 开发与配置

[← README](../README.md)

## 本地运行

需要 Node.js 22+、npm。安装依赖后运行 `npm run dev`，前端为 `http://127.0.0.1:5173`，API 为 `http://127.0.0.1:3001`，均绑定本机回环地址。

```bash
cp .env.example .env
# 在本地修改配置，然后重新启动服务。
npm run dev
```

不要提交 `.env`、登录凭据或私有数据。切换后端时注意：终端已设置的环境变量优先于 `.env`；例如使用过 `FORMA_BACKEND=demo` 的 PowerShell 会话应清除或改写该变量。

## 后端配置

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `FORMA_BACKEND` | `pi` | `pi`、`codex`、`openai` 或 `demo`；Pi/Codex 可在页面选择，不会自动回退；沿用既有变量名 |
| `PI_BIN` | `pi` | Pi 可执行文件名称/路径，不接受额外 shell 参数 |
| `PI_MODEL` | `deepseek-flash` | DeepSeek 模型的准确 ID，提供商固定 `deepseek` |
| `PI_AGENT_DIR` | 现有 Pi 配置目录 | 仅引用其中的 `auth.json` / `models.json`，不复制凭据；默认取 `PI_CODING_AGENT_DIR` 或 `~/.pi/agent` |
| `DEEPSEEK_API_KEY` | 空 | 可选的服务端 DeepSeek Key；已有 Pi 认证时无需重复设置 |
| `CODEX_BIN` | `codex` | 可执行文件名称/路径，不是包含额外参数的 shell 命令 |
| `CODEX_MODEL` | 未设置 | 使用 Codex 内置默认模型；可显式指定 |
| `CODEX_HOME` | 继承本机配置 | 可选的已有认证目录；不要把凭据复制到仓库 |
| `OPENAI_API_KEY` | 空 | 仅 OpenAI 兼容后端需要 |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI 兼容服务地址 |
| `OPENAI_MODEL` | `gpt-4.1-mini` | OpenAI 兼容后端模型 |
| `PORT` / `API_PORT` | `3001` | API 监听端口 / Vite 代理目标端口，开发时需一致 |
| `VITE_PORT` | `5173` | 前端开发端口；不可用 `VITE_*` 保存凭据 |

### Pi CLI：默认 DeepSeek Flash

在本机 Pi 中登录 DeepSeek，确认 `pi --list-models deepseek` 可见 `deepseek-flash`。本次接口依据 Pi `1.3.0`，使用 `--print --mode json` 读取 JSONL 事件。只提取最终 `message_end` 的 text 内容，并要求 `agent_settled` 正常完成；不把 thinking、流式增量或退出码 0 当成成功回复。事件流最多 4 MB，最终回复最多 96 KB。JSON 模式是传输协议，不是模型原生 JSON schema 约束。

每次请求使用独立临时工作目录和临时 Pi 配置目录，只通过符号链接引用已有 `auth.json` / `models.json`。不加载用户 settings、包、SYSTEM/APPEND_SYSTEM；显式禁用工具、MCP、扩展、技能、模板、项目上下文及持久化会话。系统契约来自本项目，用户需求和历史通过 stdin 传入。`--offline` 只禁止自动目录刷新，**不会阻止模型推理联网**。

环境只保留必要路径/网络设置和 DeepSeek Key，不继承父 Pi 的会话/钩子信息或其他供应商 Key。已有认证配置中的受信任密钥命令仍可能由 Pi 执行；这是用户的服务端配置，不是模型可调用的工具。Pi 没有 Codex 的只读 OS sandbox，此处是功能与上下文隔离，不能当成操作系统安全沙箱。临时文件结束后删除；符号链接方案目前面向 Linux/WSL，Windows 原生权限兼容仍需验证。

### Codex CLI：可选真实生成

安装 Codex CLI，在运行服务的同一用户环境执行 `codex login` 与 `codex login status`。已验证过 CLI 版本 `0.163.0`；其他版本可能需要检查参数兼容性。

服务端通过 `spawn(..., { shell: false })` 启动 `codex exec`，从 stdin 传入提示。每次请求使用独立临时目录、JSON 回复 schema、`--ephemeral`、只读 sandbox 和禁止交互式审批的配置。禁用用户配置、项目指令以及本任务不需要的 shell、web、apps、多 Agent 和 hooks；不绕过现有执行策略规则。

复用本机登录，不复制或打印凭据；不把当前项目作为 CLI 工作目录。子进程环境使用白名单过滤，但需保留认证目录和必要的网络/证书设置。

**这是本地调用，不是离线模型。** 提示、近期成功对话和当前 OpenUI 描述会发送给提供商，消耗账号额度。`--ignore-user-config` 不会继承 `config.toml` 中自定义的 provider/model；需要时使用 `CODEX_MODEL` 或显式 OpenAI 兼容后端。

### OpenAI 兼容后端

设置 `FORMA_BACKEND=openai` 及 `OPENAI_API_KEY`。服务需要支持 Chat Completions、`response_format: { type: "json_object" }`、`messages` 与 `max_tokens`。仅填写 Key 不会改变默认 Pi 后端。

### 固定规则 Demo

设置 `FORMA_BACKEND=demo`。不调用模型，支持原有仪表盘、订阅套餐、数据更新、切换颜色及中文文案等预设规则；新增「营收分析」「购物清单」「组装步骤」。未知请求返回明确说明，不伪装成自由生成。图表、查询数据和价格均为合成示例。

## 后端选择与侧边栏示例

页面「生成后端」有 Pi · DeepSeek Flash / Codex 两个选项。`GET /api/config?backend=pi|codex` 只查询所选后端，不修改全局默认；`POST /api/generate` 的可选 `backend` 字段决定本次请求。没有该字段时使用服务默认。客户端每次生成固定一次选择，运行时禁用切换；不同浏览器不会相互改变后端。

`demo` / `openai` 专用服务拒绝客户端切换到 CLI；隔离的测试/录制服务不能因前端请求意外调用真实模型。

侧边栏四个金融入口是 `src/lib/demo-prompts.ts` 中的假设数据提示，点击即发送到当前线程，不清空历史或已有输入草稿。生成期间、后端未就绪或固定 Demo 模式下禁用。窄屏通过原生展开控件打开。它们不是预生成结果，不构成金融模型认证；点击会消耗所选模型额度。

## 消息与动画

- 接口：`{ prompt, currentProgram, history, backend? } → { message, program, mode, model? }`。
- `program: null` 表示纯文字回复；非空值须为完整、经过校验的 OpenUI 程序。
- 三个真实后端共享 JSON 回复解析器：可去除完整代码围栏或唯一完整对象外的说明文字；不补括号、修改引号、拼凑截断结果或从多个候选中猜一个。随后仍执行严格回复 schema 与 OpenUI 安全校验。
- 格式错误、模型输出截断、Pi 事件未完成、提供商失败和程序安全校验失败使用不同错误提示。没有后台自动调用模型修复格式，也不会偷偷换后端；重试由用户触发。
- 每条助手回复拥有自己的控件。修改产生新回复，不覆盖旧结果。
- 请求上下文取自当前 assistant-ui 分支：最近最多 8 轮成功对话，以及最近的有效控件程序。失败/取消轮次不进入成功上下文。
- 原有控件状态及 OpenUI `$state` 仅保存在页面内，按消息隔离；切换线程后可恢复声明式状态，刷新后丢失。控件内部悬浮/翻面等临时状态不承诺恢复。
- `@ToAssistant` 只向线程输入框填入消息，用户检查后手动发送；不自动提交整份表单状态。剪贴板仅响应显式复制操作。
- 目前等待完整回复，**没有逐 token 流式输出**。等待时间是真实经过时间，不展示伪造的推理轨迹。

```text
生成完整程序 → 校验 → 提交 DOM → 字体/布局就绪 → 构建动画 → 可交互内容
```

新回复播放自己的动画；旧回复不因新消息而重播。手动重播不会重新调用模型或重置控件。返回历史对话、重新开启动画也不会自动重播整个历史。滚动/尺寸改变时取消定位浮层，避免错位；四秒 fail-open watchdog 在宿主停止绘制帧时恢复可见内容。

这是对已布局 UI 的构建与显现，不是任意图形之间的几何变形，也不是从 Canvas/图片重建像素。详见 [ADR-001](adr/001-message-owned-chat.md) 和 [动画生命周期](../skills/mypi-forma/references/replay-lifecycle.md)。

## 代码结构

```text
src/App.tsx                       assistant-ui 消息流、输入及导航
src/lib/chat-adapter.ts           对话上下文 → API → 校验后的消息内容
src/lib/backend.ts                后端选择与可取消的就绪检查
src/lib/demo-prompts.ts           侧边栏四个金融示例提示
src/components/inline-openui.tsx  消息内 Renderer、源码、导出与重播
src/components/library.tsx        总注册库及原有四卡片视图
src/components/intelligent/       迁入的组件、59 个函数、规则和合成数据
src/lib/widget-state.tsx          按消息/控件隔离本地交互
src/lib/schemas.ts                组件参数与 API 请求约束
src/lib/program.ts                初始求值校验及 Demo 规则
src/lib/program-policy.ts         表达式/函数/动作/Query 白名单与结构预算
src/lib/motion.tsx                动画生命周期适配器
src/vendor/transitions-ui-generation/  保持原样的第三方运行时
server/                          API、Pi/Codex/OpenAI 适配器、进程取消与回复校验
skills/mypi-forma/                原创 Agent Skill
scripts/record-demo.mjs           无模型调用的演示录制脚本
```

不要直接修改 vendored 动画运行时；在适配器中扩展。增加组件需同步参数 schema、注册列表、验证器、示例与测试，参见 [组件契约](../skills/mypi-forma/references/component-contract.md)。

## Skill

编码 Agent 可以直接读取 [`skills/mypi-forma/SKILL.md`](../skills/mypi-forma/SKILL.md)。也可以在对该仓库有访问权限的环境安装：

```bash
npx skills add xianxianxianyu/mypi-forma --skill mypi-forma
# 或使用你自己的本地检出目录：
npx skills add /path/to/mypi-forma --skill mypi-forma
```

Skill 用于指导编码 Agent 开发组件，不是在聊天时动态运行的工具或任意代码执行入口。运行时规则从 `src/components/intelligent/prompt-options.ts` 与实际注册库注入 Pi/Codex/OpenAI 提示；仅添加 Skill 文件不会自动改变生成器的知识。迁移详情见 [Open Intelligent UI 迁移记录](open-intelligent-ui-migration.md)。

## 验证与构建

```bash
npm test
npm run build
npm run check
npx playwright install chromium
npm run test:e2e
# 已安装 Google Chrome 时：
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
# 构建后本地运行生产版本：
npm start
```

生产版本默认在 `http://127.0.0.1:3001` 同时提供页面与 API。上述环境变量前缀语法及生产启动脚本面向 POSIX shell；Windows 可使用 WSL。

单元/API 测试使用 fake CLI 和注入适配器；E2E 使用独立端口 `5174/3002` 和显式 Demo，不复用正在运行的真实推理服务。测试不会消耗模型额度。录制演示见[素材说明](assets/README.md)。

## 安全边界

这是本机单用户 Demo。请求检查本机 Host/Origin；请求大小、提示、历史、组件数量和模型输出都有边界。默认超时 120 秒、最多两个并发生成。取消会终止 POSIX 子进程组，并有 SIGKILL 回退；Windows 后代进程清理仍需专门验证。

OpenUI 的开发调试器默认会从 CDN 下载脚本；Vite 将该入口替换为本地空实现，避免自动外链。组件不允许外部网络资源，Query 仅调用三个浏览器内合成数据提供器。

CLI 原始 stderr/events、凭据和提供商响应体不返回浏览器。临时结果文件在请求结束后删除。不提供模型可调用的任意工具、HTML、CSS 或 JavaScript。

**仓库公开不等于服务可以直接公网部署。** 对外部署前还需要认证、用户隔离、配额与费用控制、可信来源设置、持久化、CSP、观测和安全审查。发布素材只使用合成数据，许可边界见[第三方声明](../THIRD_PARTY_NOTICES.md)。
