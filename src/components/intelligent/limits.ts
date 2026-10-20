/** Shared budgets for imported computational functions and saved renderer state. */
export function assertBoundedValue(value: unknown): void {
  let entries = 0;
  let characters = 0;
  const visit = (v: unknown, depth: number) => {
    if (++entries > 100000 || depth > 32) throw new Error('UI value exceeds budget');
    if (typeof v === 'string' && (v.length > 18000 || (characters += v.length) > 1_000_000)) throw new Error('UI text exceeds budget');
    if (typeof v === 'number' && (!Number.isFinite(v) || Math.abs(v) > 1e12)) throw new Error('UI number exceeds budget');
    if (v && typeof v === 'object') {
      if (Array.isArray(v) && v.length > 5000) throw new Error('UI list exceeds budget');
      Object.values(v).forEach((item) => visit(item, depth + 1));
    }
  };
  visit(value, 0);
}
