import { describe, expect, it } from 'vitest';
import { createDemoProgram, validateProgram } from '../../src/lib/program';
import { library } from '../../src/components/library';
import { exampleDashboard, exampleShoppingList, exampleSteps } from '../../src/components/intelligent/examples';
import { demoTools } from '../../src/components/intelligent/demo-data';
import { generationInstructions } from '../../server/generation';
import { bg, webUrl } from '../../src/components/intelligent/components/style';

describe('migrated library integration', () => {
  it('registers 48 migrated components and all 59 computational functions', () => {
    expect(Object.keys(library.components)).toHaveLength(53);
    expect(Object.keys(library.functions)).toHaveLength(59);
    for (const name of ['Chart', 'Table', 'Svg', 'Math', 'Input', 'Timer', 'Flashcard']) expect(library.components).toHaveProperty(name);
    for (const name of ['HtmlView', 'Image', 'SearchImage', 'Map', 'YouTube', 'Link']) expect(library.components).not.toHaveProperty(name);
  });
  it.each([exampleDashboard, exampleShoppingList, exampleSteps])('accepts an upstream interactive example', (program) => {
    expect(() => validateProgram(program)).not.toThrow();
  });
  it.each(['营收分析', '购物清单', '组装步骤'])('offers explicitly labeled deterministic demo recipes', (prompt) => {
    const reply = createDemoProgram(prompt, '');
    expect(reply.message).toMatch(/非 AI|不会调用 AI/);
    expect(() => validateProgram(reply.program!)).not.toThrow();
  });
  it('does not pretend to edit a migrated example using unrelated legacy demo rules', () => {
    expect(createDemoProgram('改成中文', exampleShoppingList).program).toBeNull();
    expect(createDemoProgram('改成中文', exampleShoppingList).message).toContain('保持不变');
  });
  it('evaluates functions and initial state rather than treating expressions as strings', () => {
    const root = validateProgram('root = Text(@Format(@Sum(rows.amount) * $factor, "currency"))\nrows = [{amount: 10}, {amount: 5}]\n$factor = 2');
    expect(root.props.text).toBe('$30.00');
  });
  it('injects usable rules, examples, actual schemas and restricted actions into Codex instructions', () => {
    const prompt = generationInstructions();
    for (const word of ['@GroupBy', 'Chart(', 'Svg(', '$variables', 'LOCAL SYNTHETIC', 'assistant', 'clipboard', '18,000']) expect(prompt.toLowerCase()).toContain(word.toLowerCase());
    expect(prompt).not.toContain('Only four curated');
    expect(prompt).not.toContain('Only static literal');
  });
  it('keeps text links inert and rejects CSS resource loads including comment obfuscation', () => {
    expect(webUrl('https://example.com')).toBeNull();
    for (const css of ['url(https://example.com)', 'u/**/rl(https://example.com)', 'image-set("https://example.com")', 'var(--external)', 'red;position:fixed']) expect(bg(css)).toBeUndefined();
  });
  it('local Query sources are synthetic, bounded and do not fetch', async () => {
    const max = await demoTools.get_orders({ days: 90 });
    expect(await demoTools.get_orders({ days: 1e9 })).toEqual(max);
    expect((max as { rows: unknown[] }).rows.length).toBeLessThan(5000);
    expect(Object.keys(demoTools)).toEqual(['get_orders', 'get_tickets', 'get_traffic']);
  });
});

describe('declarative execution boundary', () => {
  it.each([
    'root = HtmlView("<script>alert(1)</script>")',
    'root = Image("https://example.com", "image")',
    'root = Button("open", @OpenUrl("https://example.com"))',
    'root = Button("run", @Run(task))\ntask = Mutation("get_orders", {})',
    'root = Text(x.rows)\nx = Query("fetch", {})',
    'root = Text(x.rows)\nx = Query("get_orders", {}, {rows: []}, 1)',
    'root = Text(@Evil(1))',
    'root = Text($x)\n$x = @Random(0, 1)',
    'root = Text($missing)',
    'root = Col([root])',
    'root = Col([a])\na = Col([b])\nb = Col([a])',
    'root = Text(@Range(0, 1000000))',
    'root = Text(@Each([1, 2], "a", @Each([3, 4], "b", a + b)))',
    'root = Text(@Each([1, 2], "a", nested))\nnested = @Each([3, 4], "b", b)',
    'root = Text(obj.constructor)\nobj = {a: 1}',
    'root = Text({__proto__: {polluted: true}})',
    'root = Text(1e999)',
    'root = Col([Text("valid")])\nroot = Col([])',
    'root = ' + 'Col(['.repeat(40) + 'Text("too deep")' + '])'.repeat(40),
  ])('rejects unsupported or unbounded programs: %s', (program) => {
    expect(() => validateProgram(program)).toThrow();
  });
});
