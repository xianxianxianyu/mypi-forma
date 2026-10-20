import { expect, test, type Page } from '@playwright/test';
import { exampleShoppingList, exampleSteps } from '../../src/components/intelligent/examples';

const send = async (page: Page, text: string) => {
  await page.getByLabel('输入消息').fill(text);
  await page.getByRole('button', { name: '发送消息' }).click();
};

test('migrated dashboard queries locally, filters, replays and retains per-message state across threads', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  const external: string[] = [];
  let generations = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().includes('/api/generate')) generations++;
    if (/^https?:/.test(r.url()) && new URL(r.url()).hostname !== '127.0.0.1') external.push(r.url());
  });
  await page.goto('/');
  await send(page, '生成营收分析');
  const block = page.locator('[data-openui-block]').first();
  await expect(block.getByText('合成示例数据 · 非真实业务数据')).toBeVisible();
  await expect(block.locator('.iui-chart svg')).toHaveCount(2);
  const revenue = block.locator('.iui-card').filter({ hasText: 'Revenue' }).first().locator('.iui-title-xl');
  await expect(revenue).not.toHaveText('$0');
  const allRevenue = await revenue.innerText();
  await block.getByRole('radio', { name: 'North', exact: true }).click();
  await expect(revenue).not.toHaveText(allRevenue);
  const northRevenue = await revenue.innerText();
  await block.getByRole('button', { name: '重播动画' }).click();
  await expect(revenue).toHaveText(northRevenue);
  await expect(page.locator('.t-gen')).toHaveCount(0);
  expect(generations).toBe(1);
  await send(page, '再做一个营收分析');
  await expect(page.locator('[data-openui-block]')).toHaveCount(2);
  await expect(block.getByRole('radio', { name: 'North', exact: true })).toBeChecked();
  await expect(page.locator('[data-openui-block]').last().getByRole('radio', { name: 'All', exact: true })).toBeChecked();
  await page.getByRole('button', { name: '新建对话', exact: true }).click();
  await page.getByRole('button', { name: '生成营收分析', exact: true }).click();
  await expect(block.getByRole('radio', { name: 'North', exact: true })).toBeChecked();
  await expect(revenue).toHaveText(northRevenue);
  await expect(block.getByRole('alert')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/intelligent-dashboard-desktop.png', fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(block.locator('.iui-chart svg')).toHaveCount(2);
  }
  await page.screenshot({ path: 'test-results/intelligent-dashboard-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  expect(generations).toBe(2);
});

test('migrated shopping calculations, clipboard and SVG steps work without further model calls', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  let calls = 0;
  await page.route('**/api/generate', (route) => {
    calls++;
    return route.fulfill({ json: { mode: 'demo', message: '迁移组件测试示例，非 AI。', program: calls === 1 ? exampleShoppingList : exampleSteps } });
  });
  await page.goto('/');
  await send(page, '购物清单');
  const shopping = page.locator('[data-openui-block]').first();
  await expect(shopping.getByText('Pasta night for 4 guests', { exact: true })).toBeVisible();
  await expect(page.locator('.t-gen')).toHaveCount(0, { timeout: 7000 });
  await shopping.getByRole('button', { name: 'More', exact: true }).click();
  await expect(shopping.getByText('Pasta night for 5 guests', { exact: true })).toBeVisible();
  await expect(shopping).toContainText('500 g spaghetti');
  await expect(shopping.locator('.motion-region')).toHaveAttribute('data-motion', 'idle');
  await expect(page.locator('.t-gen')).toHaveCount(0);
  await shopping.getByRole('button', { name: /500 g spaghetti/ }).click();
  await expect(shopping.getByRole('button', { name: /500 g spaghetti/ })).toHaveAttribute('aria-pressed', 'true');
  await shopping.getByRole('button', { name: 'Copy list', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('500 g spaghetti');
  await shopping.getByRole('button', { name: '重播动画' }).click();
  await expect(page.locator('.t-gen').first()).toBeVisible();
  await expect(page.locator('.t-gen')).toHaveCount(0, { timeout: 7000 });
  await expect(shopping.getByText('Pasta night for 5 guests', { exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(calls).toBe(1);
  await send(page, '组装步骤');
  const steps = page.locator('[data-openui-block]').last();
  await expect(steps.locator('.iui-svg')).toHaveCount(5);
  await expect(steps.getByText('Step 1 of 4', { exact: true })).toBeVisible();
  await steps.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(steps.getByText('Step 2 of 4', { exact: true })).toBeVisible();
  await expect(steps.getByRole('button', { name: 'Back', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'test-results/intelligent-svg-steps.png', fullPage: true });
  expect(calls).toBe(2);
});

test('assistant actions fill a reviewable draft; Markdown and math cannot navigate or load remote content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let calls = 0;
  const program = `root = Col([Input($name, "Name"), Button("Use choices", @ToAssistant("Analyze " + $name)), Markdown("[Example](https://example.com) <img src=https://example.com/pixel>"), Math("E = mc^2")])\n$name = "Ada"`;
  await page.route('**/api/generate', (route) => {
    calls++;
    return route.fulfill({ json: { mode: 'demo', message: '动作测试。', program } });
  });
  await page.goto('/');
  await send(page, '测试表单');
  const block = page.locator('[data-openui-block]');
  await expect(block.getByLabel('Name', { exact: true })).toHaveValue('Ada');
  await block.getByLabel('Name', { exact: true }).fill('Grace');
  await block.getByRole('button', { name: 'Use choices', exact: true }).click();
  await expect(page.getByLabel('输入消息')).toHaveValue('Analyze Grace');
  await expect(block.getByRole('status')).toContainText('请检查后发送');
  await expect(block.locator('a, img, iframe, script')).toHaveCount(0);
  await expect(block.locator('.katex')).toBeVisible();
  expect(calls).toBe(1);
  await page.getByLabel('输入消息').fill('Existing draft');
  await block.getByRole('button', { name: 'Use choices', exact: true }).click();
  await expect(page.getByLabel('输入消息')).toHaveValue('Existing draft');
});
