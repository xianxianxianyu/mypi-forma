import { expect, test } from '@playwright/test';
import { INITIAL_PROGRAM } from '../../src/lib/program';

test('assistant-ui keeps text and OpenUI in their own messages with bounded follow-up context', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/config', (route) => route.fulfill({ json: { mode: 'codex', model: null, ready: true } }));
  const requests: { prompt: string; currentProgram: string; history: { role: string; text: string }[] }[] = [];
  const updated = INITIAL_PROGRAM.replace('$24,680', '$42,000');
  await page.route('**/api/generate', async (route) => {
    requests.push(route.request().postDataJSON());
    const index = requests.length;
    await route.fulfill({ json: { mode: 'codex', message: index === 1 ? '记住了，你喜欢紫色。' : index === 2 ? '这是第一版。' : index === 3 ? '可以继续讨论。' : '这是更新的一版。',
      program: index === 2 ? INITIAL_PROGRAM : index === 4 ? updated : null } });
  });
  await page.goto('/');
  await expect(page.locator('.mode-label')).toHaveText('Codex CLI');
  await expect(page.locator('[data-openui-block]')).toHaveCount(0);
  const send = async (text: string) => { await page.getByLabel('输入消息').fill(text); await page.getByRole('button', { name: '发送消息' }).click(); };
  await send('记住我喜欢紫色，先不要生成控件。');
  await expect(page.getByText('记住了，你喜欢紫色。')).toBeVisible();
  await expect(page.locator('[data-openui-block]')).toHaveCount(0);
  await send('生成仪表盘');
  await expect(page.getByText('$24,680', { exact: true })).toBeVisible();
  expect(requests[1].history).toEqual([
    { role: 'user', text: '记住我喜欢紫色，先不要生成控件。' }, { role: 'assistant', text: '记住了，你喜欢紫色。' },
  ]);
  expect(requests[1].currentProgram).toBe('');
  const oldBlock = page.locator('[data-openui-block]').first();
  const toggle = oldBlock.getByRole('switch', { name: '消息通知' });
  await toggle.uncheck();
  await send('先讨论一下');
  await expect(page.getByText('可以继续讨论。')).toBeVisible();
  await expect(page.locator('[data-openui-block]')).toHaveCount(1);
  expect(requests[2].currentProgram).toBe(INITIAL_PROGRAM);
  await expect(toggle).not.toBeChecked();
  await send('接着把营收改成 42000');
  await expect(page.getByText('$42,000', { exact: true })).toBeVisible();
  await expect(page.locator('[data-openui-block]')).toHaveCount(2);
  await expect(page.getByRole('article', { name: '助手回复', exact: true })).toHaveCount(4);
  await expect(oldBlock).toContainText('$24,680');
  await expect(toggle).not.toBeChecked();
  expect(requests[3].currentProgram).toBe(INITIAL_PROGRAM);
  expect(requests[3].history).toHaveLength(6);
  await expect(page.locator('[data-openui-block]').last()).toHaveAttribute('data-source', 'codex');
  await page.getByRole('button', { name: '新建对话', exact: true }).click();
  await expect(page.locator('[data-openui-block]')).toHaveCount(0);
  await send('新的开始');
  await expect.poll(() => requests.length).toBe(5);
  expect(requests[4]).toMatchObject({ history: [], currentProgram: '' });
  await expect(page.getByText('这是更新的一版。')).toBeVisible();
  await page.getByRole('button', { name: '记住我喜欢紫色，先不要生成控件。', exact: true }).click();
  await expect(page.locator('[data-openui-block]')).toHaveCount(2);
  await expect(toggle).not.toBeChecked();
  await expect(page.locator('.t-gen')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('unavailable Codex offers recheck; failed turns retry through assistant-ui without polluting history', async ({ page }) => {
  let ready = false; let calls = 0;
  await page.route('**/api/config', (route) => route.fulfill({ json: { mode: 'codex', model: null, ready, error: ready ? undefined : '请执行 codex login' } }));
  await page.route('**/api/generate', async (route) => {
    calls++;
    expect(route.request().postDataJSON()).toMatchObject({ prompt: '你好', history: [] });
    if (calls === 1) await route.fulfill({ status: 502, json: { error: 'Codex 暂时不可用' } });
    else await route.fulfill({ json: { mode: 'codex', message: '现在可以继续了。', program: null } });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('codex login');
  await expect(page.getByLabel('输入消息')).toBeDisabled();
  await expect(page.getByRole('button', { name: '发送消息' })).toBeDisabled();
  ready = true; await page.getByRole('button', { name: '重新检测' }).click();
  await expect(page.getByLabel('输入消息')).toBeEnabled();
  await page.getByLabel('输入消息').fill('你好');
  await page.getByRole('button', { name: '发送消息' }).click();
  await expect(page.getByRole('alert')).toContainText('Codex 暂时不可用');
  await page.getByRole('button', { name: '重试这条消息' }).click();
  await expect(page.getByText('现在可以继续了。')).toBeVisible();
  await expect(page.getByRole('article', { name: '用户消息', exact: true })).toHaveCount(1);
});
