# Replay lifecycle

`intent → request → validate complete program → commit DOM → fonts/layout ready → generate(region) → reveal`

- First mount and semantic prop changes replay; ordinary parent renders do not.
- Each MotionRegion owns exactly one upstream run. Cleanup cancels its animation and its deferred start.
- Manual replay changes a context counter, not a React key; local controls retain state.
- Repeated requests abort previous browser requests. A monotonically increasing request sequence rejects stale results.
- Keep the old program while generating or when validation fails. Never replay per token.
- On scroll or resize, stop the overlay and reveal the component: the upstream overlay is positioned relative to the document, not nested scrollers.
- `cancel()` resolves upstream `finished` too. It must not be interpreted as a successful generation event. No feedback loop from `onDone` to replay.
- Honor `prefers-reduced-motion` and the user's animation toggle.
- Retain the four-second fail-open watchdog: embedded/background hosts may suspend animation frames. Content must become visible even when no animation frame ever runs.
- Avoid using MutationObserver to watch animation-owned style changes; it can trigger itself indefinitely.
- The generation animation measures already-rendered UI. It is not an actual AI progress trace and is not a generic A→B geometry morph.

For future streaming, stage partial output separately. Commit once per validated region or completed response. A short debounce alone cannot guarantee layout is final or the program is complete.

Verification: change one metric → only it replays; toggle a preference → no construction replay; replay twice rapidly → no duplicate overlays; scroll/resize/unmount → cleanup; invalid response → prior valid UI remains; reduced motion → no dot field.
