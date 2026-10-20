import { test, expect } from '@playwright/test';

test('a host that stops drawing frames cannot leave an inline UI reply hidden forever', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('本地演示 · 非 AI')).toBeVisible();
  await page.evaluate(() => {
    window.requestAnimationFrame = () => 1;
    window.cancelAnimationFrame = () => {};
    // DOM activation avoids Playwright itself waiting on the deliberately suspended frames.
    [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('生成增长仪表盘'))!.click();
  });
  await expect(page.locator('[data-widget-id]')).toHaveCount(4);
  await expect(page.getByText('Total revenue')).toBeVisible({ timeout: 7000 });
  await expect(page.locator('.motion-region').first()).toHaveAttribute('data-motion', 'idle');
  await expect(page.getByRole('switch', { name: '消息通知' })).toBeVisible();
});
