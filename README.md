# Forma Replay

**好控件，聊出来。每一次变化，重新成形。**

A conversational component studio combining **OpenUI** with **transitions.dev UI generation**. Chat on the left; a real, interactive component canvas on the right. Meaningful changes replay the construction animation without remounting the entire interface.

## Start

Node.js 22+ and npm:

```bash
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The API binds to `127.0.0.1:3001`.

No API key is needed for the local demo. It explicitly says **本地演示 · 非 AI** and applies fixed rules, not an LLM. Try:

- `更新营收和图表数据`
- `把指标卡改成柔和的紫色`
- `生成两张订阅套餐卡片`
- `把工作台改成中文文案`
- `恢复仪表盘`

Unrecognized demo requests leave the preview unchanged and explain the limitation.

## Real model generation

```bash
cp .env.example .env
# Edit .env locally: OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
npm run dev
```

The backend supports the OpenAI-compatible **Chat Completions** endpoint. Defaults: `https://api.openai.com/v1`, `gpt-4.1-mini`. Use a model supporting `messages`, `max_tokens` and non-streaming text output. A configured key switches the UI to live mode; provider errors remain visible and never silently fall back to demo output.

Only your prompt and current OpenUI program are sent to the configured provider. Keys remain server-side. Do not use `VITE_*` for credentials. No credentials are bundled or required for tests.

**This first version commits complete, validated responses rather than rendering token-by-token.** This is intentional: a 1.6-second construction animation must not restart for every token. The existing preview remains available while a new version is generated.

## Included

- Real `@openuidev/react-lang` Renderer with one shared, schema-defined component library.
- Four curated widgets: metric cards, SVG activity chart, pricing cards, and accessible preference switches.
- Local interactions: chart period, plan selection (no payment), preference toggles.
- Per-component semantic-change replay, manual replay, reduced-motion support and animation opt-out.
- Cancellation, stale-response protection, schema validation, last-good preview retention.
- In-memory version selection (up to 12 snapshots), OpenUI source view, copy and `.openui` export.
- Responsive desktop/mobile layout with no external fonts, images or analytics.
- An original coding-agent skill for authoring additional polished components.

Runtime AI composes the **registered components**; it does not create arbitrary React code. Use the coding skill to author and register new types. History and control state are local to the open page and are lost on refresh.

## Skill

The repository exposes `skills/forma-replay/SKILL.md` using the standard skill format. Coding agents can read it directly, or use the Skills CLI from an authenticated environment with access to this repository:

```bash
npx skills add xianxianxianyu/forma-replay --skill forma-replay
```

For a local checkout, from your target project:

```bash
npx skills add /data/Project/forma-replay --skill forma-replay
```

The skill covers component contracts, visual hierarchy, honest states, accessibility, motion orchestration and validation. It references the implementation rather than duplicating a third-party skill collection.

## Commands

```bash
npm test                  # contract + local API tests
npm run build             # TypeScript + Vite production build
npx playwright install chromium
npm run test:e2e           # browser interactions and replay lifecycle
# If Chromium download is unavailable but Google Chrome is installed:
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
npm run check             # tests + build
npm start                 # after build: http://127.0.0.1:3001
```

## Structure

```text
src/App.tsx                       chat, versions, request lifecycle
src/components/library.tsx        OpenUI component library and views
src/lib/schemas.ts                bounded props and API request contract
src/lib/program.ts                static validation and honest demo fixtures
src/lib/motion.tsx                semantic replay / cleanup adapter
src/vendor/transitions-ui-generation/  pinned upstream runtime
server/app.ts                     local API and model adapter
skills/forma-replay/               coding-agent skill and references
tests/                            unit, API and browser tests
```

## Motion model

`intent → OpenUI program → validate → commit DOM → measure → draw structure → reveal`

A meaningful prop change triggers only its region; unrelated cards retain state. Replay does not invoke an LLM. Scrolling or resizing cancels overlays to avoid positional drift. A four-second fail-open watchdog restores content if an embedded/background host suspends animation frames. Upstream cancellation also resolves `finished`; that promise is not used as a business-success signal.

This is a reveal of already laid-out UI, not real model progress, arbitrary SVG morphing or pixel reconstruction of a Canvas/image. Generation text panels are intentionally not used so the demo does not fabricate agent reasoning.

## Security / scope

Local single-user demo only. Both servers bind to loopback. API requests require local Host/Origin; JSON bodies, prompts, generated programs, widget counts and upstream response sizes are bounded. Model calls have a 45-second timeout and two-request concurrency cap. No tool provider or arbitrary executable content is exposed. Keys and provider response bodies are never returned to the browser.

Before public deployment add authentication, per-user quotas/rate limits, provider spending controls, trusted-origin configuration, CSP, persistent storage, observability and a security review. A configured model adapter is implemented and mocked in tests; real-provider behavior requires your own credentials and verification.

## Licensing / credits

Original project code and skill: MIT (see `LICENSE`). Vendored animation files retain the **Transitions.dev License**, not MIT. Only the UI-generation runtime actually used by this application is included, not the transition library collection. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for source commit and redistribution restrictions.

- [OpenUI](https://github.com/thesysdev/openui)
- [Transitions.dev](https://github.com/Jakubantalik/transitions.dev)
