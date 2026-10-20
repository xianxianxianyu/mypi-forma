import { evaluateRoot, type ElementNode, type OpenUIError } from '@openuidev/lang-core';
import { z } from 'zod';
import { library } from '../components/library';
import { componentSchemas } from './schemas';
import { parseAllowedProgram } from './program-policy';
import { exampleDashboard, exampleShoppingList, exampleSteps } from '../components/intelligent/examples';

const showcaseSchema = z.object({ title: z.string().min(1).max(100), subtitle: z.string().max(180), children: z.array(z.unknown()).min(1).max(6) });

/** Bounded declarative UI, local state and registered functions; never arbitrary code. */
export function validateProgram(program: string): ElementNode {
  const result = parseAllowedProgram(program);
  const schema = library.toJSONSchema();
  const errors: OpenUIError[] = [];
  const rootNode = evaluateRoot(result, { library, store: null, errors, ctx: {
    getState: (name) => result.stateDeclarations[name],
    resolveRef: () => ({ rows: [] }),
    functions: Object.fromEntries(Object.entries(schema.functions ?? {}).map(([name, fn]) => [name, { ...fn, fn: library.functions[name]!.fn }])),
    actions: schema.actions,
  } });
  if (!rootNode || errors.length) throw new Error('控件表达式无法求值，请检查参数。');
  let count = 0;
  function check(value: unknown, depth = 0) {
    if (++count > 25000 || depth > 64) throw new Error('控件展开规模过大。');
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { if (value.length > 5000) throw new Error('数据规模过大。'); value.forEach((v) => check(v, depth + 1)); return; }
    const item = value as Record<string, unknown>;
    if (item.type === 'element' && (typeof item.typeName !== 'string' || !Object.hasOwn(library.components, item.typeName))) throw new Error('包含未注册的控件。');
    Object.values(item).forEach((v) => check(v, depth + 1));
  }
  check(rootNode);
  if (rootNode.typeName !== 'Showcase') return rootNode;
  const root = showcaseSchema.parse(rootNode.props);
  const ids = new Set<string>();
  for (const child of root.children) {
    const node = child as ElementNode;
    if (!node || node.type !== 'element' || !Object.hasOwn(componentSchemas, node.typeName)) throw new Error('包含未注册的控件。');
    const schema = componentSchemas[node.typeName as keyof typeof componentSchemas];
    const props = schema.parse(node.props);
    if (ids.has(props.id)) throw new Error('控件 id 必须唯一。');
    ids.add(props.id);
    if (node.typeName === 'ActivityChart') {
      const chart = componentSchemas.ActivityChart.parse(node.props);
      if (chart.labels.length !== chart.values.length) throw new Error('图表标签与数值数量不匹配。');
    }
  }
  return rootNode;
}

const q = JSON.stringify;
export function serializeBoard(title: string, subtitle: string, children: ElementNode[]): string {
  const names = children.map((node, i) => node.statementId || `widget${i + 1}`);
  return [`root = Showcase(${q(title)}, ${q(subtitle)}, [${names.join(', ')}])`, ...children.map((node, i) => {
    const schema = componentSchemas[node.typeName as keyof typeof componentSchemas];
    const props = schema.parse(node.props) as Record<string, unknown>;
    return `${names[i]} = ${node.typeName}(${Object.keys(schema.shape).map((key) => q(props[key])).join(', ')})`;
  })].join('\n');
}

export const INITIAL_PROGRAM = `root = Showcase("Make room for better ideas.", "一组有呼吸感的工作台控件。试着用对话改变它们。", [revenue, members, activity, preferences])
revenue = MetricCard("revenue", "Total revenue", "$24,680", "+18.6%", "vs. last month", "lime")
members = MetricCard("members", "Active members", "1,842", "+12.8%", "a growing community", "lavender")
activity = ActivityChart("activity", "A little progress, every day.", "每一步，都是值得看见的增长。", [28, 42, 36, 65, 57, 86, 104], ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"])
preferences = PreferenceCard("preferences", "Make it yours.", "让工作空间按照你的节奏运转。", ["消息通知", "每周摘要", "专注模式"])`;

export function createDemoProgram(prompt: string, currentProgram: string): { program: string | null; message: string } {
  if (/先不要|不要生成|先聊|介绍|你能|hello|你好/i.test(prompt)) {
    return { program: null, message: '这是本地演示，不会调用 AI。我可以按固定规则展示卡片、交互分析、购物清单和 SVG 步骤。试试“生成营收分析”或“购物清单”；自由对话请切换到 Codex CLI 后端。' };
  }
  if (/筛选|分析|分析图表|analytics/i.test(prompt)) return { program: exampleDashboard, message: '这是迁移后的交互分析示例：使用本地合成数据，切换地区即可重算，不会调用 AI。' };
  if (/清单|采购|shopping/i.test(prompt)) return { program: exampleShoppingList, message: '这是本地购物清单示例：调整人数、勾选物品和复制清单均在本地完成，非 AI。' };
  if (/步骤|书架|组装|steps/i.test(prompt)) return { program: exampleSteps, message: '这是本地 SVG 分步示例，切换步骤会更新说明与图示，非 AI。' };
  const candidate = validateProgram(currentProgram || INITIAL_PROGRAM);
  if (candidate.typeName !== 'Showcase' && !/价格|订阅|套餐|pricing|plan|仪表盘|dashboard|重置|重新开始/i.test(prompt)) {
    return { program: null, message: '当前交互示例没有对应的本地修改规则；已有回复保持不变。自由修改请使用 Codex 后端，或输入“营收分析”“购物清单”“组装步骤”查看固定示例。' };
  }
  const board = candidate.typeName === 'Showcase' ? candidate : validateProgram(INITIAL_PROGRAM);
  let children = structuredClone(board.props.children) as ElementNode[];
  let title = String(board.props.title);
  let subtitle = String(board.props.subtitle);
  let matched = false;
  if (/价格|订阅|套餐|pricing|plan/i.test(prompt)) {
    children = [
      { type: 'element', typeName: 'PlanCard', partial: false, props: { id: 'starter', title: 'Starter', price: '¥0 / 月', description: '给每一个好想法，一个轻盈的起点。', features: ['3 个项目空间', '基础控件库', '构建动画预览'], buttonLabel: '从这里开始' } },
      { type: 'element', typeName: 'PlanCard', partial: false, props: { id: 'studio', title: 'Studio', price: '¥99 / 月', description: '为更认真创作的你，多留一些可能。', features: ['无限项目空间', '完整组件导出', '团队协作', '优先支持'], buttonLabel: '选择 Studio' } },
    ];
    title = 'Small start. Big possibilities.'; subtitle = '两种节奏，同样出色的创作体验。价格仅为演示。'; matched = true;
  } else if (/仪表盘|dashboard|重置|重新开始/i.test(prompt)) {
    return { program: INITIAL_PROGRAM, message: '以下是使用示例数据的仪表盘（本地演示，非 AI）。你可以继续告诉我如何修改。' };
  }
  if (/紫|lavender|purple|绿|lime|green|橙|peach|orange/i.test(prompt)) {
    const tone = /紫|lavender|purple/i.test(prompt) ? 'lavender' : /橙|peach|orange/i.test(prompt) ? 'peach' : 'lime';
    children = children.map((node) => node.typeName === 'MetricCard' ? { ...node, props: { ...node.props, tone } } : node);
    matched = true;
  }
  if (/增长|数据|营收|收入|revenue|增长率|update/i.test(prompt)) {
    children = children.map((node) => {
      if (node.typeName === 'MetricCard') return { ...node, props: { ...node.props, value: node.props.id === 'revenue' ? '$32,840' : '2,136', change: '+24.2%' } };
      if (node.typeName === 'ActivityChart') return { ...node, props: { ...node.props, values: [42, 57, 51, 84, 76, 112, 136] } };
      return node;
    });
    matched = true;
  }
  if (/中文|chinese/i.test(prompt)) {
    title = '为好想法，留一点空间。'; subtitle = '清晰的信息、克制的色彩，以及恰到好处的动态。';
    children = children.map((node) => node.typeName === 'MetricCard' ? { ...node, props: { ...node.props, label: node.props.id === 'revenue' ? '总营收' : '活跃成员', caption: '较上月增长' } } : node.typeName === 'ActivityChart' ? { ...node, props: { ...node.props, title: '每天一点，看得见的进步。' } } : node);
    matched = true;
  }
  if (!matched) return { program: null, message: '本地演示支持：营收分析、购物清单、组装步骤，以及原有仪表盘、订阅套餐、更新数据、切换紫/绿/橙色、改成中文。自由生成需要配置服务端模型；本次没有生成新控件。' };
  const program = serializeBoard(title, subtitle, children);
  validateProgram(program);
  return { program, message: '已按本地演示规则生成这一版控件。之前的回复和交互状态保留在原消息中；这条回复的控件可以独立操作。' };
}
