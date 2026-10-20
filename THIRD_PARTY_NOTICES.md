# Third-party notices

## Scope of the repository MIT license

`LICENSE` (MIT) covers original myPi Forma code, documentation and Skill. It does **not** relicense third-party material. In particular, files under `src/vendor/transitions-ui-generation/` retain the separate Transitions.dev License below, and adapted Open Intelligent UI files retain their MIT notice at `src/components/intelligent/LICENSE`. npm dependencies are not vendored and keep their own package licenses.

## Transitions.dev UI generation runtime

Source: https://github.com/Jakubantalik/transitions.dev/tree/7ec0b0b0b8beb15788a9de68a40ec6be2d5e84b5/skills/transitions-ui-generation

Pinned upstream commit: `7ec0b0b0b8beb15788a9de68a40ec6be2d5e84b5`.

Unmodified files used by this application:

- `src/vendor/transitions-ui-generation/ui-generation.js`
- `src/vendor/transitions-ui-generation/ui-generation.css`
- `src/vendor/transitions-ui-generation/LICENSE.txt`

Copyright (c) 2026 Jakub Antalik / Transitions.dev.

These files are **not MIT licensed**. Their license permits use and modification in personal/commercial applications but prohibits repackaging the collection as a competing transitions library, motion pack or animation kit. See the adjacent license and https://github.com/Jakubantalik/transitions.dev/blob/7ec0b0b0b8beb15788a9de68a40ec6be2d5e84b5/LICENSE for full repository terms, including template/UI-kit provisions. Review those terms before turning this application into a distributed starter kit.

The TypeScript declaration and lifecycle adapter are original project code. This repository does not redistribute the upstream skill collection.

## Open Intelligent UI

Source: https://github.com/thesysdev/open-intelligent-ui/tree/03213439358bf3408ad61a46ec9e3230c5572e48

Pinned upstream commit: `03213439358bf3408ad61a46ec9e3230c5572e48`.

Copyright (c) 2026 Thesys Inc. Licensed under MIT; the full notice is preserved at `src/components/intelligent/LICENSE`.

Adapted component implementations, design tokens, functions, local synthetic data, clipboard helper, prompt rules and examples live in `src/components/intelligent/`. Adapted upstream computation tests live in `tests/intelligent/functions/`. File origins, exclusions and local changes are recorded in `src/components/intelligent/README.md`. The upstream AgentInterface application and API routes are not redistributed here.

## Dependencies

OpenUI, React, Vite, Express, Zod and other npm dependencies retain their own licenses in their installed packages. Lucide icons are used under their package license. Exact versions are pinned by `package-lock.json`.
