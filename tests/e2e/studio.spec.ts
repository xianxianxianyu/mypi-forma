import { test, expect } from '@playwright/test';

test('chat edits only changed widgets, keeps interaction state and replays safely', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('本地演示 · 非 AI')).toBeVisible();
  await expect(page.locator('.motion-region').first()).toHaveAttribute('data-motion', 'idle', { timeout: 7000 });
  await expect(page.locator('.t-gen')).toHaveCount(0, { timeout: 7000 });
  await expect(page.locator('[data-widget-id]')).toHaveCount(4);
  const toggle = page.getByRole('switch', { name: '消息通知' });
  await toggle.uncheck(); await expect(toggle).not.toBeChecked();
  await page.getByRole('button', { name: '换成柔和紫色' }).click();
  await expect(page.locator('[data-widget-id="revenue"]')).toHaveClass(/tone-lavender/);
  await expect(toggle).not.toBeChecked();
  // Unchanged settings must not replay on a metric-only edit.
  await expect(page.locator('.motion-region').filter({ has: page.locator('[data-widget-id="preferences"]') })).toHaveAttribute('data-motion', 'idle');
  await expect(page.locator('.t-gen')).toHaveCount(0, { timeout: 7000 });
  await page.getByRole('button', { name: '重播', exact: true }).click();
  await expect(page.locator('.t-gen').first()).toBeVisible();
  await page.getByRole('button', { name: '重播', exact: true }).click();
  expect(await page.locator('.t-gen').count()).toBeLessThanOrEqual(4);
  await expect(page.locator('.t-gen')).toHaveCount(0, { timeout: 7000 });
  await page.getByRole('button', { name: 'OpenUI', exact: true }).click();
  await expect(page.locator('pre')).toContainText('MetricCard');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出' }).click();
  expect((await downloaded).suggestedFilename()).toBe('forma-replay.openui');
  expect(errors).toEqual([]);
});

test('pricing controls, version restore, reduced motion and mobile layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByText('本地演示 · 非 AI')).toBeVisible();
  await page.getByRole('button', { name: '设计订阅套餐' }).click();
  await expect(page.getByRole('heading', { name: 'Studio', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '选择 Studio' }).click();
  await expect(page.getByRole('button', { name: /已选择/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('查看历史版本').selectOption('0');
  await expect(page.getByText('Total revenue')).toBeVisible();
  await expect(page.locator('.t-gen')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('invalid results preserve the last valid preview; stop discards late responses', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.route('**/api/generate', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: '测试：模型不可用' }) }));
  await page.getByRole('button', { name: '换成柔和紫色' }).click();
  await expect(page.getByRole('alert')).toContainText('模型不可用');
  await expect(page.getByText('Total revenue')).toBeVisible();
  await page.unroute('**/api/generate');
  await page.route('**/api/generate', async (route) => { await new Promise((resolve) => setTimeout(resolve, 1500)); await route.abort(); });
  await page.getByRole('button', { name: '更新增长数据' }).click();
  await page.getByRole('button', { name: '停止生成' }).click();
  await expect(page.getByText('已取消本次生成，保留上一个有效版本。')).toBeVisible();
  await expect(page.getByText('Total revenue')).toBeVisible();
});
