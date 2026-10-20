# Open Intelligent UI 迁移记录

本次迁移现成能力，不改变聊天框架、生成后端或动画运行时，也不新增垂直行业图表设计。

## 来源与范围

上游：[thesysdev/open-intelligent-ui](https://github.com/thesysdev/open-intelligent-ui)，固定提交 `03213439358bf3408ad61a46ec9e3230c5572e48`，MIT © 2026 Thesys Inc.。源文件及修改清单见 [`src/components/intelligent/README.md`](../src/components/intelligent/README.md)，原始许可已保留。

| 已迁移 | 内容 |
| --- | --- |
| 布局 | Box、Row、Col、Grid、Card、Divider、Spacer、Form |
| 文本 | Title、Text、Caption、Label、Badge、List、ListItem、Markdown |
| 控件 | Button、IconButton、Pressable、Input、TextArea、Select、SegmentedControl、Slider、Checkbox、RadioGroup、DatePicker、Timer |
| 数据展示 | Chart（bar / line / area / pie / donut / scatter）、Table |
| 绘图 | Svg、Circle、Ellipse、Rect、Line、Path、Polyline、Polygon、G、SvgText、Icon |
| 辅助 | Carousel、Popover、Code、Quote、Math、Flashcard、Celebration |
| 本地计算 | 全部 59 个函数，包括列表增删、格式化、日期、统计、GroupBy、Pivot、Bucket、MovingAvg、Histogram |
| 数据提供器 | get_orders、get_tickets、get_traffic；浏览器内生成合成数据，不访问网络或真实数据库 |
| 生成指导 | 从注册库生成的契约、布局/交互规则、购物清单、SVG 组装步骤及分析面板示例 |

新增 48 个组件；原有 Showcase、MetricCard、ActivityChart、PlanCard、PreferenceCard 保留，总计 53 个注册组件定义。

**未迁移/未开放**：AgentInterface、上游聊天持久化、Next.js API、Cloud 纠错服务、HtmlView、地图、搜索图片/远程图片、YouTube、Link 导航、Mutation、@Run 和外部 URL 动作。没有导入模型生成脚本执行能力。开发模式下自动下载 CDN 调试器的入口也替换为本地空实现。

## 保持不变的归属

- assistant-ui：消息、分支、输入框、取消、重试与本页会话列表。
- Pi / Codex CLI：推理后端；目前默认 Pi · DeepSeek Flash，可切换 Codex。仍返回最终 `{ message, program }`，不伪装流式生成。
- OpenUI Renderer：每条消息的组件、表达式、`$state` 与本地计算。
- transitions：整块内容的构建/显现，不负责 SVG 曲线逐笔绘制。

OpenUI `initialState` / `onStateUpdate` 接入消息级内存存储。不同回复的同名 `$state` 相互独立，重播不重挂载 Renderer；切换线程后恢复声明式状态。刷新页面仍清空历史与状态。悬浮、滚动、轮播位置、闪卡翻面和计时器运行/暂停等组件内部临时 React 状态不承诺跨线程恢复；计时器绑定的剩余秒数属于声明式状态。

`@Set` / `@Reset` 只修改当前消息。显式点击 `@CopyToClipboard` 才写剪贴板；`@ToAssistant` 只把选定消息放进**线程输入框**，由用户检查后发送，不自动调用模型，也不覆盖已有草稿。完整表单状态不会自动发送；需要的选择应明确写入动作消息。

## 验证和边界

服务端和客户端使用同一程序策略：先检查源码 AST 的调用白名单、状态声明、括号/引用循环和规模，再交给 OpenUI parser 和初始求值检查。原有四卡片的 ID、数值及长度约束继续保留。

- 程序 ≤18,000 字符、6,000 tokens、160 条语句、400 个语法调用；限制嵌套、引用展开、数组和函数结果。
- 状态初值必须是字面量；只允许注册函数和本地动作；不允许嵌套 `@Each` 主体。
- Query 仅允许三个固定合成源、无刷新定时器；最多 90 天、订单最多 50 条/天。
- 颜色/长度只能通过已有属性和过滤函数；文本链接不可点击；没有任意 CSS、HTML、JS 或网络工具。
- KaTeX 是可信公式渲染器，不是 HTML 执行入口：关闭 trust 并限制展开与尺寸。
- 函数超限或坏参数由 OpenUI 报错；新回复校验失败不替换历史内容。应用仍是 loopback-only 单用户实验，以上边界不等于面向恶意多租户输入的隔离执行环境。

## 直接体验

```bash
FORMA_BACKEND=demo npm run dev
```

输入「生成营收分析」「购物清单」或「组装步骤」。这些是明确标为 **非 AI** 的本地固定示例；真实自由组合使用 Pi 或 Codex 后端。复制示例并不意味着模型一定能一次生成同等质量的程序。

## 保留的上游语义与限制

本次没有重写图表算法。Chart 的部分无效/缺失值会被转为零，堆叠计算会裁掉负贡献；不适用于需要严格缺失值语义或正负堆叠的场景。百分比通常是 `45` 表示 45%，不是 `0.45`。金额/日期格式仍有上游默认地区/币种语义。合成数据按 UTC 日期播种，每天的数据稳定，但跨天查询窗口会变化。

通用 Svg 仍由模型负责几何布局；没有新增漏斗、留存、桑基或工程绘图专用引擎。当前构建会给出主 bundle 偏大的警告，KaTeX 和通用图表增加了体积，Lucide 图标按本地模块懒加载；后续优化不属于这次迁移。

## 回归入口

- `npm run check`：原有 API/CLI/聊天测试、迁入的函数数值测试、程序边界测试、类型检查和生产构建。
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`：原有聊天回归，加上分析筛选/合成查询、消息状态隔离/线程恢复、购物清单/剪贴板、SVG 步骤、草稿动作、无外链、320/390px 和减少动态效果。
- 浏览器测试使用 Demo 或固定响应，未调用真实 Pi/Codex/OpenAI；不代表已完成真实模型的生成质量基准。
