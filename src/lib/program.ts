import { createParser, type ElementNode } from '@openuidev/lang-core';
import { z } from 'zod';
import { library } from '../components/library';
import { componentSchemas } from './schemas';

const showcaseSchema = z.object({ title: z.string().min(1).max(100), subtitle: z.string().max(180), children: z.array(z.unknown()).min(1).max(6) });

/** Static, bounded components only: no model-authored code, tools, or expressions. */
export function validateProgram(program: string): ElementNode {
  if (program.length > 18000) throw new Error('生成内容过长，请缩小需求范围。');
  const result = createParser(library.toJSONSchema(), library.root).parse(program);
  if (!result.root || result.root.typeName !== 'Showcase' || result.meta.incomplete || result.meta.errors.length || result.meta.unresolved.length || result.meta.orphaned.length) {
    throw new Error('生成的 OpenUI 不完整或包含不支持的控件，请重试。');
  }
  if (Object.keys(result.stateDeclarations ?? {}).length || result.rootExpression) throw new Error('仅支持静态控件描述。');
  const root = showcaseSchema.parse(result.root.props);
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
  return result.root;
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

export function createDemoProgram(prompt: string, currentProgram: string): { program: string; message: string } {
  const board = validateProgram(currentProgram || INITIAL_PROGRAM);
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
    return { program: INITIAL_PROGRAM, message: '已恢复初始工作台；变化区域将重新构建。' };
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
  if (!matched) return { program: currentProgram || INITIAL_PROGRAM, message: '本地演示只支持：仪表盘、订阅套餐、更新数据、切换紫/绿/橙色、改成中文。自由生成需要配置服务端模型；本次没有修改控件。' };
  const program = serializeBoard(title, subtitle, children);
  validateProgram(program);
  return { program, message: '已应用本地演示规则。只有内容变化的控件会重新播放构建动画；开关等本地交互状态保持不变。' };
}
