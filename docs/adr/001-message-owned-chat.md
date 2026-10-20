# ADR-001: Message-owned conversational UI

- Status: accepted and implemented
- Date: 2026-10-19
- Owner: myPi Forma maintainers
- Decision authority: operator explicitly selected assistant-ui / OpenUI / transitions / Codex CLI
- Supersedes: the original split chat + global canvas implementation (no prior ADR)

Implementation update: inference now defaults to Pi CLI / DeepSeek Flash, with Codex selectable per request. This does not change the message-ownership decision below; both backends share context derivation, validation and abort boundaries. See [backend configuration](../development.md#后端选择与侧边栏示例).

## Context and drivers

The original app treated conversation as commands for a shared preview canvas. The operator instead wants normal contextual chat, with interactive UI embedded in assistant replies. Existing requirements remain: bounded component vocabulary, honest demo/inference labels, preserved local interactions, cancellation, and construction motion only after a valid semantic commit.

## Options

1. **Keep custom React chat + global canvas**: less migration, but the wrong product model and duplicated conversation/request state.
2. **AI SDK + a new chat view**: useful provider/stream protocols, but unnecessary alongside the existing isolated Codex backend and not a substitute for chat UI primitives.
3. **OpenUI's chat layer**: viable integrated UI; not selected because the operator wants separate chat, widget, animation and inference responsibilities.
4. **assistant-ui local runtime + custom adapter**: selected. Owns messages, input, cancellation, retry and in-page thread navigation while preserving the server contract.

## Decision and ownership

| Owner | Responsibility | Does not own |
| --- | --- | --- |
| assistant-ui | Thread/branch messages, composer, run lifecycle, abort/retry, copy, navigation | OpenUI schemas, model subprocesses |
| `chat-adapter.ts` | Derive bounded context from active messages; call the API; validate the reply; construct text/data parts | A duplicate chat history or global canvas |
| OpenUI | Render validated `data/openui` parts with the registered library | Arbitrary HTML/code/tools or model inference |
| transitions adapter | First-appearance/semantic commit and explicit per-message replay | Token streaming or model progress |
| Express + Pi/Codex CLI | Readiness, isolated inference, time/output limits, process cancellation and response validation | Browser state, remote thread storage |

Current runtime flow (application/component view; arrows mean data handed to the next owner):

```text
User → assistant-ui composer → active thread messages
  → ChatModelAdapter → POST /api/generate → Express → isolated Pi/Codex CLI
  → validated { message, program, mode }
  → assistant-ui text + optional data/openui part
  → OpenUI DOM → transitions construction/reveal
```

The browser and Express remain loopback-only. Both CLIs can contact their external inference providers; local CLI authentication does not mean offline inference.

### Message and context contract

- The welcome view has no generated widgets. Ordinary discussion returns `program: null`.
- Every successful UI response contains its own complete OpenUI program and provenance (`pi`, `codex`, `openai`, or `demo`; Pi also records the configured model). Revisions become **new replies**; prior content is never edited in place.
- `currentProgram` is the latest valid program in the active branch. A text-only response does not erase it. A new conversation starts with an empty string and no history.
- Up to eight completed user/assistant pairs accompany generation. Failed/cancelled exchanges are excluded. UI may be older than that window and is still supplied as the edit base.
- Duplicate widget ids across messages are allowed, but state is keyed by message id + widget id. Replaying, new replies and thread navigation preserve existing controls; new replies have independent controls.
- `seen` identities suppress automatic replay when revisiting a thread. Manual replay affects only its message. Turning animations back on does not replay history.
- Cancellation forwards assistant-ui's AbortSignal to fetch; the adapter also checks it before returning a final result. Express closes the selected CLI process group on disconnect/timeout.

## Consequences and limits

**Positive:** one chat source of truth; visible conversational provenance; older results remain inspectable; independent widgets and replay; no cloud chat account or new provider protocol required.

**Negative:** more frontend dependencies and bundle weight; a long conversation retains multiple rendered UI snapshots and in-memory state; chat behavior now depends on assistant-ui APIs. Responses are still final validated JSON, **not incremental token streams**. Sidebar titles are derived from the first user message, not an extra model call.

**Neutral:** history/state remain page-local and are lost on refresh. Local switch/plan/chart state is not sent to the model. Follow-up edits default to the latest UI; addressing an arbitrary older UI snapshot is not implemented. The old canvas/version picker is intentionally removed; there is no persisted history to migrate.

## Risks, validation and revisit triggers

- Malformed/unsafe output: validate on server and adapter, allowlist components, disable Markdown HTML/remote images/navigation, preserve older messages on errors.
- State collision or accidental animation: scoped state/replay and browser tests for historical vs new controls, repeated replay, thread navigation and opt-out.
- Failed/cancelled context contamination: adapter unit tests and browser retry/late-response tests.
- Accessibility/layout: native composer primitives, named controls, polite message log, keyboard/multiline tests, 320/390px layouts, reduced motion and fail-open suspended-frame tests.
- Verification: `npm run check` and `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`. These tests use fake/injected CLI and explicit-demo servers, not billed inference.
- Revisit for true Codex streaming, long-lived/large histories, durable storage, explicit older-snapshot editing, or multi-user deployment. None is implied by this change.

## Evidence

- `src/App.tsx`, `src/lib/chat-adapter.ts`, `src/components/inline-openui.tsx`, `src/lib/widget-state.tsx`
- `server/generation.ts`, `server/codex.ts`, `src/lib/motion.tsx`
- `tests/chat-adapter.test.ts`, `tests/e2e/chat.spec.ts`, `tests/e2e/studio.spec.ts`, `tests/e2e/suspended-host.spec.ts`
- [assistant-ui architecture](https://www.assistant-ui.com/docs/architecture)
- [assistant-ui runtime architecture](https://www.assistant-ui.com/docs/runtimes/concepts/architecture)
