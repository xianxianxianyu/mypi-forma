# Replay lifecycle

`intent → request → validate complete program → commit DOM → fonts/layout ready → generate(region) → reveal`

- Each new message-owned UI block plays once; semantic prop changes replay within a mounted block. Ordinary parent renders and arrivals of other messages do not replay historical blocks.
- Remember previously shown message/program identities for this page session. Returning to a thread does not replay its history. Re-enabling animation is not a request to replay every prior reply.
- Each MotionRegion owns exactly one upstream run. Cleanup cancels its animation and its deferred start.
- Manual replay changes that message's context counter, not a React key; local controls retain state. `useWidgetState` scopes controls by message + widget id, including across thread navigation.
- assistant-ui owns running/cancelled/failed states and retry. Forward its AbortSignal to fetch and check it again before committing a final response; late cancelled results must never become message content.
- A generated revision belongs to a new assistant reply. Keep older programs and interaction state intact while waiting or on failure. Never replay per token.
- On scroll or resize, stop the overlay and reveal the component: the upstream overlay is positioned relative to the document, not nested scrollers.
- `cancel()` resolves upstream `finished` too. It must not be interpreted as a successful generation event. No feedback loop from `onDone` to replay.
- Honor `prefers-reduced-motion` and the user's animation toggle.
- Retain the four-second fail-open watchdog: embedded/background hosts may suspend animation frames. Content must become visible even when no animation frame ever runs.
- Avoid using MutationObserver to watch animation-owned style changes; it can trigger itself indefinitely.
- The generation animation measures already-rendered UI. It is not an actual AI progress trace and is not a generic A→B geometry morph.

For future streaming, stage partial output separately. Commit once per validated region or completed response. A short debounce alone cannot guarantee layout is final or the program is complete.

Verification: send a UI edit → a new reply animates, old replies retain content/state; toggle a preference → no construction replay; replay one message twice rapidly → no duplicate overlays or remounts; return to a thread → no auto-replay and controls retain state; scroll/resize/unmount → cleanup; invalid/cancelled response → prior messages remain; reduced motion → no dot field.
