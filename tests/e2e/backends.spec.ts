import { expect, test } from '@playwright/test';
import { demoPrompts } from '../../src/lib/demo-prompts';
import { INITIAL_PROGRAM } from '../../src/lib/program';

test('sidebar sends a prompt with selected backend, preserves drafts/history and locks during a run', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/config*', (route) => {
    const mode = new URL(route.request().url()).searchParams.get('backend') || 'pi';
    return route.fulfill({ json: { mode, model: mode === 'pi' ? 'deepseek-flash' : null, ready: true } });
  });
  const requests: { prompt: string; backend: string; history: unknown[] }[] = [];
  let finish!: () => void;
  const waiting = new Promise<void>((resolve) => { finish = resolve; });
  await page.route('**/api/generate', async (route) => {
    const body = route.request().postDataJSON(); requests.push(body);
    if (requests.length === 1) await waiting;
    await route.fulfill({ json: { message: `${body.backend} 固定测试回复`, program: body.backend === 'pi' ? INITIAL_PROGRAM : null, mode: body.backend,
      ...(body.backend === 'pi' ? { model: 'deepseek-flash' } : {}) } });
  });
  await page.goto('/');
  const selector = page.getByRole('combobox', { name: '生成后端' });
  await expect(selector).toHaveValue('pi');
  await expect(page.getByText('Pi · DeepSeek Flash', { exact: true }).last()).toBeVisible();
  const examples = page.getByRole('group', { name: '金融示例提示' });
  await expect(examples.getByRole('button')).toHaveCount(4);
  await page.getByLabel('输入消息').fill('保留这份草稿');
  await examples.getByRole('button', { name: /债券估值与利率风险/ }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toMatchObject({ prompt: demoPrompts[1].prompt, backend: 'pi', history: [] });
  await expect(selector).toBeDisabled();
  for (const button of await examples.getByRole('button').all()) await expect(button).toBeDisabled();
  finish();
  await expect(page.getByText('pi 固定测试回复', { exact: true })).toBeVisible();
  await expect(page.getByLabel('输入消息')).toHaveValue('保留这份草稿');
  await expect(page.locator('[data-source="pi"]')).toBeVisible();
  await expect(page.locator('[data-source="pi"]')).toContainText('Pi · DeepSeek Flash 生成');
  await selector.selectOption('codex');
  await expect(selector).toBeEnabled();
  await examples.getByRole('button', { name: /信用风险压力测试/ }).click();
  await expect(page.getByText('codex 固定测试回复', { exact: true })).toBeVisible();
  expect(requests[1]).toMatchObject({ backend: 'codex', prompt: demoPrompts[2].prompt });
  expect(requests[1].history).toHaveLength(2);
  await expect(page.locator('[data-source="pi"]')).toBeVisible();
  await expect(page.getByLabel('输入消息')).toHaveValue('保留这份草稿');
  expect(errors).toEqual([]);
});

test('mobile sidebar examples are keyboard reachable; unavailable Pi can switch to Codex', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route('**/api/config*', (route) => {
    const mode = new URL(route.request().url()).searchParams.get('backend') || 'pi';
    return route.fulfill({ json: { mode, model: mode === 'pi' ? 'deepseek-flash' : null, ready: mode === 'codex', ...(mode === 'pi' ? { error: 'Pi 暂未登录 DeepSeek' } : {}) } });
  });
  let calls = 0;
  await page.route('**/api/generate', (route) => {
    calls++; return route.fulfill({ json: { mode: 'codex', message: '固定测试响应，无模型调用', program: null } });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Pi 暂未登录');
  await page.locator('.sidebar-examples > summary').click();
  const examples = page.getByRole('group', { name: '金融示例提示' });
  await expect(examples.getByRole('button').first()).toBeDisabled();
  await page.getByRole('combobox', { name: '生成后端' }).selectOption('codex');
  const button = examples.getByRole('button', { name: /13 周现金流预测/ });
  await expect(button).toBeEnabled();
  await button.focus(); await page.keyboard.press('Enter');
  await expect(page.getByText('固定测试响应，无模型调用', { exact: true })).toBeVisible();
  expect(calls).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: 'test-results/backend-sidebar-mobile.png', fullPage: true });
});
