# myPi Forma

**让想法成为界面。**

*Dynamic UI generation and interactive presentation for myPi.*

myPi Forma 是 **myPi 的动态 UI 生成与交互呈现模块**。它把 **OpenUI 的结构化 UI 生成**与 **transitions.dev 的构建动画**结合起来，并复用 **Open Intelligent UI 的组件、计算函数与设计规则**：用对话生成可交互的图表和控件，让结果可以操作、修改和重播。

我们关心的不只是「生成一张图」，而是：**如何把人的问题转成合适的可视化，并让结果可理解、可交互、可修改。**

[架构](#架构) · [快速开始](#快速开始) · [发展方向](#发展方向) · [开发指南](docs/development.md) · [参考仓库](#参考仓库与使用范围) · [许可](#许可)

## 看看效果

![myPi Forma 实际界面演示：通过对话生成套餐卡片，选择套餐，重播构建动画，再生成中文文案版本。](docs/assets/demo.gif)

**真实界面录制，使用本地固定规则 Demo，不是 AI 推理录像。** 流程：生成控件 → 本地交互 → 重播动画 → 对话修改。GIF 仅播放一次；也可[查看静态截图](docs/assets/demo.png)或[重新录制](docs/assets/README.md)。

## 这是什么

这是一个持续演进的**对话式可视化实验项目**，目前以可运行的本地应用和 Agent Skill 为起点，而不是一个已经完备的通用图表库。

控件直接出现在助手回复里，没有独立画布。后续修改生成新回复，不覆盖旧结果；每条消息拥有独立的声明式交互状态。

## 架构

```text
用户输入 → assistant-ui → Express API → Pi / Codex CLI
                            ↑              ↓
                    组件契约、规则与示例   文字 + OpenUI 程序
                                           ↓
                                  服务端与客户端校验
                                           ↓
                                 新消息中的 OpenUI Renderer
                                    ├─ 组件、状态与本地计算
                                    └─ transitions 构建动画
```

| 部分 | 职责 |
| --- | --- |
| **assistant-ui** | 聊天消息、会话、输入框、取消与重试 |
| **Pi / Codex CLI** | 默认 Pi · DeepSeek Flash，可在界面切换 Codex；另支持专用 OpenAI 接口与显式 Demo |
| **OpenUI SDK** | 解析程序、求值表达式、管理状态并渲染注册组件 |
| **Open Intelligent UI** | 迁入的组件、59 个计算函数、设计规则、示例与本地合成数据源 |
| **transitions.dev** | 内容提交后的构建与显现，支持手动重播，不负责图表逐笔绘制 |
| **myPi Forma** | 上下文整理、后端调用、程序校验、消息级状态保存与动画适配 |

**对话生成和控件交互是两条路径**：创建或修改界面会调用模型；调整输入、筛选数据和切换步骤在浏览器本地计算。动画在完整程序校验后播放，**不是模型思考过程，也不是逐 token 绘图**。

我们迁移的是 Intelligent UI 的**内容层**，没有替换为它的 AgentInterface 聊天框架，也没有引入其 Next.js 后端、Cloud 纠错服务或聊天持久化。

## 现在能做什么

- **53 个注册组件定义**：保留原有四种卡片及 Showcase，迁入 48 个布局、图表、表格、SVG、输入与辅助组件。
- **正常多轮对话**：既能讨论想法，也能生成或修改控件；纯文字回复不附带控件。
- **后端切换与示例提示**：Pi · DeepSeek Flash / Codex 两个生成选项；侧边栏提供组合、债券、信用风险、现金流四个金融提示，点击发送到当前对话。这些是待模型生成的假设案例，不是预生成或已认证的金融模型。
- **真实本地交互与计算**：59 个计算函数、状态绑定、筛选/聚合、清单增删、SVG 步骤切换；不为本地计算额外调用模型。
- **独立重播与导出**：按消息重播动画、查看 OpenUI 源码、导出 `.openui` 文件。
- **可控的生成边界**：组件白名单、参数校验、取消与超时、减少动态效果支持。
- **生成规则与 Agent Skill**：已接入迁移后的组件契约、设计规则和完整示例；Skill 另用于指导编码 Agent 扩展。

[Open Intelligent UI 迁移范围、使用方式与保留限制 →](docs/open-intelligent-ui-migration.md)

> 当前模型只能组合已注册的组件，不能生成任意 React、HTML 或行业图表。聊天及控件状态只保留在当前页面，刷新后清空。这是本机单用户 Demo，不是可直接部署的多用户服务。

## 快速开始

需要 **Node.js 22+** 和 npm。

```bash
git clone https://github.com/xianxianxianyu/mypi-forma.git
cd mypi-forma
npm ci
```

### 先看效果：不需要模型账号

```bash
FORMA_BACKEND=demo npm run dev
```

打开 **http://127.0.0.1:5173**，点击「设计订阅套餐」或「生成增长仪表盘」。也可输入「生成营收分析」「购物清单」「组装步骤」，体验迁移后的计算、筛选和 SVG。Demo 使用固定规则与合成数据，界面明确标注「本地演示 · 非 AI」。

Windows PowerShell 可先执行 `$env:FORMA_BACKEND="demo"`，再运行 `npm run dev`；也可以在 `.env` 中配置。

### 用自己的想法生成：Pi 或 Codex

默认使用 [Pi](https://github.com/earendil-works/pi) 的 `deepseek/deepseek-flash`。先在本机 Pi 中登录 DeepSeek，或为服务端配置 `DEEPSEEK_API_KEY`，然后：

```bash
pi --list-models deepseek
# 在未设置 FORMA_BACKEND 的新终端运行；或在 .env 中设为 pi。
npm run dev
```

打开页面，在「生成后端」选择 **Pi · DeepSeek Flash** 或 **Codex CLI**，再点击侧边栏「金融示例」。Codex 需要先安装并执行 `codex login`。切换不清空历史，生成过程中不可切换；不会自动回退到另一个后端或固定 Demo。

Pi 复用本机认证/模型配置，但生成进程禁用工具、MCP、扩展、技能和项目上下文。**本地 CLI 不代表离线推理**：请求仍发送给所选模型提供商，并消耗账号额度。专用 `demo` 服务不开放金融提示或真实后端切换。

可以试试：

- 「先不要生成，介绍一下有哪些控件。」
- 「用合成订单数据生成营收分析面板，支持地区筛选、趋势图和产品排行。」
- 「制作一个可调整本金、利率和期限的等额本息计算器，标注假设数据。」
- 「保留计算逻辑，把界面文案改成中文。」

[后端配置、OpenAI 兼容接口及运行限制 →](docs/development.md)

## 发展方向

后续围绕两条主线更新。**以下是路线图，不是已经支持的功能清单，也没有承诺交付日期。**

### 1. 教 Agent 把人的想法转成合适的图表

不只教 Agent 「怎么画」，更要教它「为什么这么画」：

- 从模糊描述中识别目标、受众、数据和待回答的问题。
- 判断是比较、趋势、分布、关系还是流程，再选择合适的视觉表达。
- 澄清缺失数据，标注单位、口径和假设，不用漂亮的图掩盖不确定性。
- 把方法沉淀为可复用的 **Skill、示例与评估用例**。

当前入口是 [`skills/mypi-forma/`](skills/mypi-forma/SKILL.md)，已有组件设计与动画接入规范；完整的可视化推理方法仍待扩展。

### 2. 积累垂直领域专用的图表

从真实问题出发，而不是单纯堆叠图表种类。候选方向包括增长分析中的转化漏斗与留存、项目管理中的进度与依赖、运维中的延迟分布等。

每个领域示例计划包含：**业务问题 + 数据契约 + 图表组件 + 交互/动态说明 + Agent 使用指引 + 测试**。领域组件会复用通用方法，领域案例也会反过来改进方法。

[详细路线图与贡献标准 →](docs/roadmap.md)

## 参与项目

欢迎从一个具体案例开始：**你想回答什么问题、有哪些数据、当前表达哪里不够清楚？** 请使用脱敏或合成数据，不要提交客户数据、凭据或内部截图。

- 改进 Agent 方法：提供输入、预期表达、失败案例与判断标准。
- 增加领域图表：先解释业务语义，再增加组件、参数校验和测试。
- 改进动画与交互：确保重播不重置控件，支持键盘和减少动态效果。

编码 Agent 可直接阅读项目 [Skill](skills/mypi-forma/SKILL.md)。它用于指导开发和扩展组件；不是每次聊天时动态执行的工具。

```bash
npm run check             # 单元/API 测试、类型检查、生产构建
npx playwright install chromium
npm run test:e2e          # 独立 Demo 服务，不调用付费模型
```

架构决策见 [ADR-001](docs/adr/001-message-owned-chat.md)，目录与开发细节见[开发指南](docs/development.md)。

## 参考仓库与使用范围

本项目不是从零实现所有组件和动画。感谢以下上游项目；这里区分**代码迁入、依赖使用与外部调用**，不将上游能力归为原创。

| 上游仓库 | 使用方式 | 在本项目中的用途与边界 |
| --- | --- | --- |
| [thesysdev/open-intelligent-ui](https://github.com/thesysdev/open-intelligent-ui) | **迁入并适配源码** | 48 个组件、59 个计算函数、设计 tokens、提示规则、示例和合成数据；未迁入 AgentInterface、Next.js 后端或 Cloud 纠错服务。来源版本 [`0321343`](https://github.com/thesysdev/open-intelligent-ui/tree/03213439358bf3408ad61a46ec9e3230c5572e48)，[迁移清单](src/components/intelligent/README.md)。 |
| [thesysdev/openui](https://github.com/thesysdev/openui) | **npm 依赖** | 使用 `@openuidev/react-lang` / `lang-core` 解析 OpenUI、求值和渲染注册组件；与上面的 Intelligent UI 内容层是两个不同项目。 |
| [assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui) | **npm 依赖** | 聊天运行时、消息、输入框、线程与取消/重试；不负责模型推理或控件计算。 |
| [Jakubantalik/transitions.dev](https://github.com/Jakubantalik/transitions.dev) | **内置原始运行时** | 使用 `transitions-ui-generation` 的 JS/CSS 呈现构建动画；没有复制完整动画集合。来源版本 [`7ec0b0b`](https://github.com/Jakubantalik/transitions.dev/tree/7ec0b0b0b8beb15788a9de68a40ec6be2d5e84b5/skills/transitions-ui-generation)，通过本项目适配器接入。 |
| [earendil-works/pi](https://github.com/earendil-works/pi) | **调用本机 CLI** | 默认通过 Pi 调用 DeepSeek Flash；不内置 Pi 源码、模型权重或账号凭据。 |
| [openai/codex](https://github.com/openai/codex) | **调用本机 CLI** | 可选生成后端，复用本机登录；不内置 Codex 源码或账号凭据。 |

本项目自行实现了消息级 UI 集成、上下文整理、后端适配、程序安全策略、本地状态隔离、重播生命周期和回归测试。其他依赖包括 React、Vite、Express、Zod、[KaTeX](https://github.com/KaTeX/KaTeX) 与 [Lucide](https://github.com/lucide-icons/lucide)；确切版本见 `package-lock.json`。

## 许可

- **本仓库原创代码、文档和 Skill 采用 [MIT License](LICENSE)。**
- 迁入的 Intelligent UI 代码与规则保留 **MIT © 2026 Thesys Inc.**，见[原始许可](src/components/intelligent/LICENSE)。
- 内置动画运行时采用独立的 **[Transitions.dev License](src/vendor/transitions-ui-generation/LICENSE.txt)**，**不是 MIT**。本项目将其用于应用，不作为动画库或 UI Kit 分发；若将本项目改作模板、Starter Kit 或 UI Kit，须另行核对上游[完整条款](https://github.com/Jakubantalik/transitions.dev/blob/7ec0b0b0b8beb15788a9de68a40ec6be2d5e84b5/LICENSE)。
- 其他依赖保留各自许可；本项目不代表上述上游项目，也不暗示官方合作或背书。详细来源及版权声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
