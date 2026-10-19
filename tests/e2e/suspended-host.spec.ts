import { test, expect } from '@playwright/test';

test('a host that stops drawing frames cannot leave the UI hidden forever', async ({ page }) => {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 1;
    window.cancelAnimationFrame = () => {};
  });
  await page.goto('/');
  await expect(page.locator('[data-widget-id]')).toHaveCount(4);
  await expect(page.getByText('Total revenue')).toBeVisible({ timeout: 7000 });
  await expect(page.locator('.motion-region').first()).toHaveAttribute('data-motion', 'idle');
  await expect(page.getByRole('switch', { name: '消息通知' })).toBeVisible();
});
