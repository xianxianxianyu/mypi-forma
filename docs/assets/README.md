# README 演示素材

- `demo.gif`：真实浏览器操作录制，生成套餐卡片 → 选择套餐 → 重播 → 发送中文文案修改。
- `demo.png`：同一次录制中的静态截图，适合不想观看动画的读者。
- 使用合成价格与固定规则 Demo，界面标注「本地演示 · 非 AI」。没有模型调用、真实账户信息或支付行为。
- GIF 压缩为 960px 宽、8fps，正常速度、仅播放一次，不无限循环。它展示 UI 行为，不用于衡量模型延迟。

## 重新录制

在仓库根目录运行。需要 Node.js、npm、系统 `ffmpeg`（可在 PATH 中找到），以及 Playwright 的浏览器和录像编码器：

```bash
npm ci
npx playwright install chromium ffmpeg
node scripts/record-demo.mjs
# 或使用已安装的 Google Chrome：
PLAYWRIGHT_CHANNEL=chrome node scripts/record-demo.mjs
```

脚本先构建生产版本，再启动独立的 `FORMA_BACKEND=demo` 服务（`127.0.0.1:3004`）。端口被占用时拒绝复用。不会使用正在运行的真实生成服务，不会调用 Codex/OpenAI。

只有最终 GIF 和 PNG 写入本目录。原始录像使用临时目录，结束后删除；浏览器和录制服务会清理。录像使用生产版本，避免把开发工具浮层录进 README。脚本目前在 Linux 验证；Windows 建议使用 WSL。

素材展示原创应用界面及集成的第三方动画效果，并不改变其许可。请保留[第三方声明](../../THIRD_PARTY_NOTICES.md)。
