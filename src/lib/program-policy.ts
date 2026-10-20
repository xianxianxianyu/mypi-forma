import { createParser, parseExpression, split, tokenize, walkAST, type ASTNode } from '@openuidev/lang-core';
import { library } from '../components/library';

const builtins = new Set(['Count', 'First', 'Last', 'Sum', 'Avg', 'Min', 'Max', 'Sort', 'Filter', 'Round', 'Abs', 'Floor', 'Ceil', 'Each']);
const localActions = new Set(['Set', 'Reset', 'steps', 'ToAssistant', 'CopyToClipboard']);
const sources = new Set(['get_orders', 'get_tickets', 'get_traffic']);
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);
const fail = (reason: string): never => { throw new Error(`OpenUI 安全校验失败：${reason}`); };
const literal = (node: ASTNode): boolean => {
  switch (node.k) {
    case 'Str': case 'Num': case 'Bool': case 'Null': return true;
    case 'Arr': return node.els.every(literal);
    case 'Obj': return node.entries.every(([, v]) => literal(v));
    case 'UnaryOp': return node.op === '-' && node.operand.k === 'Num';
    default: return false;
  }
};

/** Check source AST before reference expansion or evaluation; never execute source code. */
export function parseAllowedProgram(program: string) {
  if (!program.trim() || program.length > 18000) fail('内容为空或超过 18,000 字符。');
  const tokens = tokenize(program);
  if (tokens.length > 6000) fail('语法规模过大。');
  // Token kinds come from the public tokenizer: ()=1/2, []=3/4, {}=5/6.
  // Check before recursive parsing, including malformed/unbalanced input.
  const stack: number[] = [];
  for (const token of tokens) {
    if ([1, 3, 5].includes(token.t)) stack.push(token.t);
    if (stack.length > 32) fail('嵌套过深。');
    if ([2, 4, 6].includes(token.t) && stack.pop() !== token.t - 1) fail('括号不匹配。');
  }
  if (stack.length) fail('括号未闭合。');
  const raw = split(tokens);
  if (!raw.length || raw.length > 160) fail('语句数量超限。');
  const statements = new Map<string, ASTNode>();
  const aliases = new Set<string>();
  for (const statement of raw) {
    if (statements.has(statement.id) || forbiddenKeys.has(statement.id.replace(/^\$/, ''))) fail('语句名称重复或非法。');
    const ast = parseExpression(statement.tokens);
    if (!ast) fail('无法解析语句。');
    if (statement.id.startsWith('$') && !literal(ast!)) fail('状态默认值必须为字面量。');
    statements.set(statement.id, ast!);
    walkAST(ast!, (node) => {
      if (node.k === 'Comp' && node.name === 'Each' && node.args[1]?.k === 'Str') aliases.add(node.args[1].v);
    });
  }
  if (!statements.has('root')) fail('缺少 root。');
  let calls = 0;
  let queries = 0;
  const graph = new Map<string, string[]>();
  for (const [id, ast] of statements) {
    const refs: string[] = [];
    walkAST(ast, (node) => {
      if (node.k === 'Comp') {
        if (++calls > 400) fail('调用数量超限。');
        if (node.name === 'Query') {
          if (++queries > 3 || node.args.length > 3 || node.args[0]?.k !== 'Str' || !sources.has(node.args[0].v)) fail('只允许三个本地合成数据源，不允许刷新定时器。');
        } else if (!Object.hasOwn(library.components, node.name) && !Object.hasOwn(library.functions, node.name) && !builtins.has(node.name) && !localActions.has(node.name)) {
          fail(`不支持的组件、函数或动作：${node.name}`);
        }
        if (node.name === 'Each' && node.args[2]) {
          walkAST(node.args[2], (child) => { if (child.k === 'Comp' && child.name === 'Each') fail('请避免嵌套列表展开。'); });
        }
        if (node.name === 'Timer') {
          walkAST(node, (child) => { if (child.k === 'Comp' && ['ToAssistant', 'CopyToClipboard'].includes(child.name)) fail('定时器只能修改本地状态。'); });
        }
      }
      if (node.k === 'Ref' && statements.has(node.n)) refs.push(node.n);
      if (node.k === 'Ref' && !statements.has(node.n) && !aliases.has(node.n)) fail(`未定义的引用：${node.n}`);
      if (node.k === 'StateRef' && node.n !== '$value' && !statements.has(node.n)) fail(`未声明的状态：${node.n}`);
      if (node.k === 'Arr' && node.els.length > 1000) fail('数组过长。');
      if (node.k === 'Obj' && node.entries.some(([key]) => forbiddenKeys.has(key))) fail('非法字段名。');
      if (node.k === 'Member' && forbiddenKeys.has(node.field)) fail('非法字段访问。');
      if (node.k === 'Str' && forbiddenKeys.has(node.v)) fail('非法字段引用。');
      if (node.k === 'Num' && (!Number.isFinite(node.v) || Math.abs(node.v) > 1e12)) fail('数字超出允许范围。');
    });
    graph.set(id, refs);
  }
  // Bound expanded references, not just source length; reject cycles before parser expansion.
  const active = new Set<string>();
  const weights = new Map<string, number>();
  function weight(id: string, depth = 0): number {
    if (active.has(id) || depth > 32) return fail('引用循环或嵌套过深。');
    if (weights.has(id)) return weights.get(id)!;
    active.add(id);
    const n = 1 + (graph.get(id) ?? []).reduce((sum, ref) => sum + weight(ref, depth + 1), 0);
    active.delete(id);
    if (n > 1000) fail('引用展开规模过大。');
    weights.set(id, n);
    return n;
  }
  for (const id of statements.keys()) weight(id);
  // A statement alias must not bypass the nested-expansion restriction.
  const rejectNestedEach = (body: ASTNode, seen = new Set<string>()) => {
    walkAST(body, (child) => {
      if (child.k === 'Comp' && child.name === 'Each') fail('请避免嵌套列表展开。');
      if (child.k === 'Ref' && statements.has(child.n) && !seen.has(child.n)) {
        seen.add(child.n);
        rejectNestedEach(statements.get(child.n)!, seen);
      }
    });
  };
  for (const ast of statements.values()) walkAST(ast, (node) => {
    if (node.k === 'Comp' && node.name === 'Each' && node.args[2]) rejectNestedEach(node.args[2]);
  });
  const parsed = createParser(library.toJSONSchema(), library.root).parse(program);
  if ((!parsed.root && !parsed.rootExpression) || parsed.meta.incomplete || parsed.meta.errors.length || parsed.meta.unresolved.length || parsed.meta.orphaned.length || parsed.mutationStatements.length) fail('内容不完整或参数无效。');
  return parsed;
}
