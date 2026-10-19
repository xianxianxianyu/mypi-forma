# Forma Replay

A local-first chat demo for curated OpenUI components and replayable UI generation motion.

- Read `skills/forma-replay/SKILL.md` for component/motion work.
- Stack: React, TypeScript, Vite, Express, OpenUI Lang; npm and package-lock.json.
- `npm run check` runs unit/API tests, type checking and production build.
- `npm run test:e2e` runs browser integration tests. Install Chromium using `npx playwright install chromium` first.
- Demo mode is deterministic and explicitly labeled. Never imply AI was called when it was not.
- Model keys stay server-side in ignored `.env`. Never print, commit, or expose them via VITE_*.
- Use only allowlisted components with validated, bounded props. No arbitrary HTML, JavaScript, CSS, tools or network actions from model output.
- Keep statement names and component ids stable; preserve local interaction state.
- Animate semantic commits, not every render or token. Keep last valid content on errors.
- Do not rewrite files in `src/vendor/transitions-ui-generation/`; use the adapter in `src/lib/motion.tsx`.
- Preserve vendor notices and license. Do not repackage the transitions library as a kit.
- This is a loopback-only demo, not a production multi-user service. Authentication, quotas, durable history and deployment hardening are not implemented.
