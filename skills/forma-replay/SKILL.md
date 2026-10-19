---
name: forma-replay
description: Build polished, accessible OpenUI components and conversational previews with replayable generation motion. Use for generating a widget, refining a dashboard or pricing card, adding a component to Forma Replay, or replaying an animation after meaningful data changes. 关键词：优秀控件、生成组件、聊天生成 UI、构建动画、变化后重播。
---

# Forma Replay

Turn an intent into a useful, carefully composed component. Motion explains a committed change; it is not proof of real model progress.

## Start

1. Read the project's `AGENTS.md`, `package.json`, `src/lib/schemas.ts`, `src/components/library.tsx`, and `src/lib/motion.tsx`.
2. Establish the component's job, the information hierarchy, its real interaction, and empty/error/disabled states. Ask one question only if a missing detail blocks the design.
3. Reuse the existing four components before adding another. For new components read [the component contract](references/component-contract.md).
4. For animation changes read [the replay lifecycle](references/replay-lifecycle.md).

## Design discipline

- Give each card one clear purpose and one primary action. Put the main value or task before secondary metadata.
- Prefer comfortable spacing, a restrained accent palette, clear type hierarchy, readable labels, and meaningful units. Do not make every element a bright callout.
- Use real interactive HTML with accessible names, keyboard focus, and honest feedback. A payment demo must never pretend to charge; synthetic chart data must never be labeled live business data.
- Cover narrow screens, long labels, zero values, errors and reduced motion.
- Do not add decorative controls that do nothing. Do not use arbitrary model-authored HTML, scripts, CSS, remote images, or `eval`.

## Implement

1. Model bounded props with Zod in `src/lib/schemas.ts`. Append new props; never reorder positional arguments in a published component contract.
2. Implement the React view in the component library and register it in the root's allowed child union, `createLibrary`, and server validator.
3. Keep source statement names and `id` stable on edits. Generate model instructions from the actual library, not a handwritten duplicate contract.
4. Wrap the component's visual root in `MotionRegion` using a deterministic signature of semantic props. Keep local input state inside the view; never force remounts merely to replay.
5. Inference returns a complete, validated version. Keep the old valid version on failure. Local fixture rules must remain visibly labeled as non-AI.
6. Add contract tests, then verify rendering and at least one real interaction in a browser.

## Deliver

Run `npm run check` and `npm run test:e2e`. Report changed files, exact checks, and any untested live-provider behavior. Do not claim arbitrary component generation: the model can compose only the registered vocabulary until you add more components.

## Rights and credentials

The project skill is original. The vendored transitions.dev runtime has its own license; preserve its attribution and do not distribute it as a standalone motion kit. Never print API keys or copy them into browser props, prompts, logs, or `VITE_*` variables.
