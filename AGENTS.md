# myPi Forma

The dynamic UI generation and interactive presentation module for myPi: a local-first chat app with curated OpenUI components and replayable generation motion.

- Read `skills/mypi-forma/SKILL.md` for component/motion work.
- Stack: React, TypeScript, Vite, Express, assistant-ui, OpenUI Lang; npm and package-lock.json.
- Boundaries: assistant-ui owns chat/runtime; OpenUI owns message-inline widgets; transitions owns construction animation; Pi or Codex CLI owns inference. See `docs/adr/001-message-owned-chat.md`.
- `npm run check` runs unit/API tests, type checking and production build.
- `npm run test:e2e` runs an isolated demo server on 5174/3002; never reuse the user's live inference server. Install Chromium using `npx playwright install chromium`, or use `PLAYWRIGHT_CHANNEL=chrome` with installed Chrome.
- Default inference uses local Pi CLI with deepseek/deepseek-flash; the UI can select Codex per request. Pi uses a temporary config directory referencing only existing auth/models, with no tools/MCP/extensions/skills/project context/session persistence. Keep both CLIs' filtered environment, bounded output and process-group cancellation intact; Codex retains its read-only sandbox.
- Demo mode is explicit (`FORMA_BACKEND=demo`), deterministic and labeled. Never silently fall back between Pi/Codex/OpenAI or to demo. Dedicated demo servers must not permit switching to a real CLI.
- Chat-only replies have `program: null`. Derive bounded successful history and latest valid UI from the active assistant-ui branch, not a parallel canvas/history store. New UI versions belong to new assistant replies; never overwrite older messages.
- Model keys stay server-side in ignored `.env`. Never print, commit, or expose them via VITE_*.
- Use only allowlisted components with validated, bounded props. No arbitrary HTML, JavaScript, CSS, tools or network actions from model output.
- Keep statement names and component ids stable; preserve local interaction state. Scope local controls and manual replay to each message; the same widget id in different replies must not share state.
- Animate semantic commits, not every render or token. Keep last valid content on errors.
- Do not rewrite files in `src/vendor/transitions-ui-generation/`; use the adapter in `src/lib/motion.tsx`.
- Preserve vendor notices and license. Do not repackage the transitions library as a kit.
- This is a loopback-only demo, not a production multi-user service. Authentication, quotas, durable history and deployment hardening are not implemented.
