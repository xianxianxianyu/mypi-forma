# Component contract

## Registered vocabulary

The library has 53 component definitions: 48 adapted Open Intelligent UI components plus the five original definitions (Showcase and four cards). Prefer `Col` as the composition root; other registered roots and conditional roots are supported.

- Layout: Box, Row, Col, Grid, Card, Divider, Spacer, Form.
- Content: Title, Text, Caption, Label, Badge, List, ListItem, Markdown, Table, Chart.
- Input: Button, IconButton, Pressable, Input, TextArea, Select, SegmentedControl, Slider, Checkbox, RadioGroup, DatePicker, Timer.
- Drawing: Svg, Circle, Ellipse, Rect, Line, Path, Polyline, Polygon, G, SvgText, Icon.
- Utility: Carousel, Popover, Code, Quote, Math, Flashcard, Celebration.

Exact argument order comes from each component's Zod schema and `library.prompt()`, not this list. Append new positional props rather than reordering existing ones. Read `src/components/intelligent/prompt-options.ts` for runtime design/interaction rules and `examples.ts` for working programs.

The original contract remains compatible:

- `Showcase(title, subtitle, children)` — 1–6 original widgets.
- `MetricCard(id, label, value, change, caption, tone)` — lime / lavender / peach.
- `ActivityChart(id, title, subtitle, values, labels)` — 3–12 nonnegative values; matching label count.
- `PlanCard(id, title, price, description, features, buttonLabel)` — 1–5 benefits; no payment.
- `PreferenceCard(id, title, description, options)` — 1–4 accessible switches.

## State, computation and actions

```text
root = Col([Input($people, "Guests", "number"), Text(@Plural(@Clamp(@Default($people, 1), 1, 20), "guest"))])
$people = 4
```

- Use literal `$variable` defaults. Use the registered 59 functions and allowlisted language built-ins to derive values; use `@Set` / `@Reset` for local changes.
- Stable statement/variable names matter. Each assistant message owns its state. Replay must not remount the Renderer, and revisiting a thread restores declarative state from the message-scoped store.
- `@CopyToClipboard` is explicit click-triggered copying. `@ToAssistant` fills a reviewable thread-composer draft; it never auto-sends or overwrites an existing draft. Entire form state is not transmitted automatically.
- Query accepts only `get_orders`, `get_tickets`, `get_traffic`, with up to 90 days of local **synthetic** data. Label these as sample data; no refresh timer, Mutation, @Run or arbitrary provider.
- Use JSON-safe string escaping. No cycles/orphans, model-defined functions, arbitrary HTML/JS/CSS, network resources or external actions. Text links are inert. Keep inside `src/lib/program-policy.ts` budgets, including a 18,000-character program and Range of at most 256 entries.

## Extending safely

1. Reuse the imported vocabulary before adding components. For original cards add bounded schemas to `componentSchemas`; imported definitions live in `src/components/intelligent/` and its explicit registry.
2. Check structural AST policy and runtime validation, not only React output. Reject unknown calls before evaluation.
3. Derive generation contracts from the actual library. Update runtime rules, fixtures and this Skill separately.
4. Imported pages use one outer `MotionRegion` signed by program source, so local inputs do not replay construction. Keep component-specific motion separate. Legacy cards retain their existing wrappers.
5. Test valid/invalid props, numerical semantics, live controls, message isolation, thread navigation, replay, narrow widths and reduced motion.
6. Preserve upstream MIT notice and record adaptations. Do not promise upgraded chart semantics: missing/invalid values and negative stacks retain upstream limitations.

New trusted components are authored by the coding Agent, not executed from model-authored JavaScript. This is a loopback-only demo, not a hostile-code sandbox.
