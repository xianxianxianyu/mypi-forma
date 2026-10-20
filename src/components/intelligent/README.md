# Open Intelligent UI source adaptation

Source: https://github.com/thesysdev/open-intelligent-ui

Pinned commit: `03213439358bf3408ad61a46ec9e3230c5572e48`.

Copyright © 2026 Thesys Inc. **MIT**, preserved in [LICENSE](LICENSE).

This directory adapts the upstream `src/lib/` implementation, not its Next.js app or chat shell. myPi Forma keeps assistant-ui, its Codex backend and message-owned Renderer.

## Imported source

- `components/`: layout, text/Markdown, controls, charts, table, SVG primitives, utility components, Lucide glyphs, tokens and CSS.
- `components/icon.tsx`: the `Icon` definition extracted from upstream `components/media.tsx`; no image search or fetch code.
- `functions/`: all 59 upstream functions (lists, numbers, text, dates, colors, data).
- `actions.ts`: explicit clipboard action and host helper.
- `demo-data.ts`: local seeded synthetic orders/tickets/traffic providers.
- `examples.ts`: shopping, SVG assembly and dashboard examples extracted from upstream `prompt-options.ts`.
- `prompt-options.ts`: adapted design/interaction rules; excludes unsupported media, maps, HTML and external actions.
- `tests/intelligent/functions/` (at repository root): upstream function/pattern tests with local import paths and timezone-independent timestamp fixtures.

## Local adaptations

- Explicit registry in `index.ts`: 48 upstream components, plus five original component definitions in the parent library. Excluded: HtmlView, Map, MapMarker, SearchImage, Image, YouTube and Link.
- Removed YouTube implementation; text links are inert. Style filtering also rejects CSS comments. KaTeX uses `trust:false`, bounded size and expansion; only trusted KaTeX output enters `dangerouslySetInnerHTML`.
- Styles/tokens are scoped to `.intelligent-ui`; portal content carries that scope. KaTeX CSS is imported from the browser entry only, so the server can load component schemas.
- Input text is limited to 2,000 characters. Function arguments/results have size/depth budgets; Range is limited to 256 entries; Replace checks expansion before allocation.
- Synthetic queries accept at most 90 days; orders are capped at 50/day. Their example is visibly labeled synthetic. No actual business data or network connector is included.
- Source policy, host actions, message-scoped state and construction motion live outside this directory in myPi Forma adapters. No upstream AgentInterface, localStorage chat store, API routes, Cloud correction service or arbitrary script execution is imported.

These are source adaptations, not a guarantee that every upstream gallery program is accepted. Inherited chart/data semantics are documented in [the migration notes](../../../docs/open-intelligent-ui-migration.md).
