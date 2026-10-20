---
name: mypi-forma
description: Build polished, accessible OpenUI components and conversational previews with replayable generation motion. Use for generating a widget, refining a dashboard or pricing card, adding a component to myPi Forma, or replaying an animation after meaningful data changes. 关键词：优秀控件、生成组件、聊天生成 UI、构建动画、变化后重播。
---

# myPi Forma

The dynamic UI generation and interactive presentation module for myPi.

Turn an intent into a useful, carefully composed component. Motion explains a committed change; it is not proof of real model progress.

## Start

1. Read the project's `AGENTS.md`, `package.json`, `src/lib/schemas.ts`, `src/components/library.tsx`, and `src/lib/motion.tsx`. For chat integration also read `src/lib/chat-adapter.ts` and `src/components/inline-openui.tsx`: assistant-ui owns chat, OpenUI owns message-inline widgets, transitions owns animation, and Pi or Codex CLI owns generation.
2. Establish the component's job, the information hierarchy, its real interaction, and empty/error/disabled states. Ask one question only if a missing detail blocks the design.
3. Reuse the registered library: 48 migrated layout/chart/table/SVG/input/utility components and the original Showcase/four cards, plus 59 computational functions. Read `src/components/intelligent/README.md` for source attribution and exclusions, and [the component contract](references/component-contract.md) before extending it.
4. For animation changes read [the replay lifecycle](references/replay-lifecycle.md).

## Design discipline

- Give each card one clear purpose and one primary action. Put the main value or task before secondary metadata.
- Prefer comfortable spacing, a restrained accent palette, clear type hierarchy, readable labels, and meaningful units. Do not make every element a bright callout.
- Use real interactive HTML with accessible names, keyboard focus, and honest feedback. A payment demo must never pretend to charge; synthetic chart data must never be labeled live business data.
- Cover narrow screens, long labels, zero values, errors and reduced motion.
- Do not add decorative controls that do nothing. Do not use arbitrary model-authored HTML, scripts, CSS, remote images, or `eval`.

## Implement

1. Model bounded props with Zod; original cards use `src/lib/schemas.ts`, imported components own their schemas in `src/components/intelligent/`. Append new props; never reorder positional arguments.
2. Register trusted components/functions explicitly. Update `src/lib/program-policy.ts` and `src/lib/program.ts` when extending executable language capabilities; never bypass validation to accept a model response.
3. Keep source statement names and `id` stable on edits. Generate model instructions from the actual library, not a handwritten duplicate contract.
4. Original cards use `MotionRegion` and `useWidgetState`, scoped to message + widget id. Imported compositions use one outer `MotionRegion` signed by source program, with OpenUI `initialState` / `onStateUpdate` saved per message. Do not nest construction wrappers or replay on every input change. Never force remounts merely to replay or share state between replies.
5. Inference defaults to a tool/resource-disabled local Pi CLI (DeepSeek Flash), with Codex selectable per request. Do not weaken either backend's credential isolation, cancellation or shared program validation. Return `{ message, program }`, with `program: null` for discussion without widgets. UI edits return a complete, validated program in a NEW assistant message, not a replacement global canvas. Derive successful bounded history and the latest valid program from the active assistant-ui branch. Keep older replies intact on failure; never silently fall back to demo rules.
6. Add contract tests, then verify rendering and at least one real interaction in a browser.

## Deliver

Run `npm run check` and `npm run test:e2e`. Report changed files, exact checks, and any untested live-provider behavior. Do not claim arbitrary component generation: the model can compose only the registered vocabulary until you add more components.

## Rights and credentials

The project skill is original; the imported Open Intelligent UI implementation, examples and adapted runtime rules are MIT © 2026 Thesys Inc., with notices retained in `src/components/intelligent/LICENSE`. The vendored transitions.dev runtime has its own license; preserve its attribution and do not distribute it as a standalone motion kit. Never print API keys or copy them into browser props, prompts, logs, or `VITE_*` variables.
