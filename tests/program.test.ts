import { describe, expect, it } from 'vitest';
import { createDemoProgram, INITIAL_PROGRAM, validateProgram } from '../src/lib/program';
import { library } from '../src/components/library';

describe('bounded OpenUI contract', () => {
  it('validates the initial board and all demo branches', () => {
    expect(validateProgram(INITIAL_PROGRAM).typeName).toBe('Showcase');
    for (const prompt of ['更新数据', '订阅套餐', '中文', '紫色', '橙色', '绿色', '重置']) {
      expect(() => validateProgram(createDemoProgram(prompt, INITIAL_PROGRAM).program!)).not.toThrow();
    }
  });
  it('preserves unchanged statements and reports unknown demo requests honestly', () => {
    const next = createDemoProgram('紫色', INITIAL_PROGRAM).program!;
    expect(next).toContain('preferences = PreferenceCard');
    const before = validateProgram(INITIAL_PROGRAM).props.children as { props: unknown }[];
    const after = validateProgram(next).props.children as { props: unknown }[];
    expect(after[3].props).toEqual(before[3].props);
    const unknown = createDemoProgram('build a spaceship', next);
    expect(unknown.program).toBeNull();
    expect(unknown.message).toContain('本次没有生成');
    expect(createDemoProgram('先不要生成，介绍支持的控件', '').program).toBeNull();
  });
  it('preserves literal escaping', () => {
    const withQuote = INITIAL_PROGRAM.replace('Total revenue', 'Total \\"revenue\\"');
    expect(() => validateProgram(createDemoProgram('紫色', withQuote).program!)).not.toThrow();
  });
  it.each([
    'root = Script("alert(1)")',
    'root = Showcase("x", "y", [missing])',
    'root = Showcase("x", "y", [])',
    INITIAL_PROGRAM.replace('"members", "Active', '"revenue", "Active'),
    INITIAL_PROGRAM.replace('[28, 42, 36, 65, 57, 86, 104]', '[1, 2, 3]'),
    INITIAL_PROGRAM.replace('[28, 42, 36, 65, 57, 86, 104]', '[-1, 42, 36, 65, 57, 86, 104]'),
    INITIAL_PROGRAM.replace('"lime")', '"invalid")'),
    `${INITIAL_PROGRAM}\nextra = MetricCard("x", "x", "x", "x", "x", "lime")`,
    INITIAL_PROGRAM.slice(0, -2),
    'a'.repeat(18001),
  ])('rejects invalid, unbounded, or unregistered content', (program) => {
    expect(() => validateProgram(program)).toThrow();
  });
  it('generates its model instructions from the actual library', () => {
    const prompt = library.prompt();
    for (const name of ['Showcase', 'MetricCard', 'ActivityChart', 'PlanCard', 'PreferenceCard']) expect(prompt).toContain(name);
  });
});
