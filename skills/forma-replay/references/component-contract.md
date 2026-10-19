# Component contract

Current root: `Showcase(title, subtitle, children)` — 1–6 registered widgets.

Arguments are positional and must follow schema key order:

- `MetricCard(id, label, value, change, caption, tone)` — tone: lime / lavender / peach.
- `ActivityChart(id, title, subtitle, values, labels)` — 3–12 nonnegative values; matching label count.
- `PlanCard(id, title, price, description, features, buttonLabel)` — 1–5 benefits; local selection only.
- `PreferenceCard(id, title, description, options)` — 1–4 accessible switches; local state only.

Example:

```text
root = Showcase("A clearer picture.", "Sample data, designed with care.", [revenue])
revenue = MetricCard("revenue", "Monthly revenue", "$24,680", "+18.6%", "vs. previous month", "lime")
```

Use JSON-safe string escaping. Keep statement names and widget ids stable across edits. Do not create orphan statements. Do not add expressions, state variables, tools, network access or actions to a static program.

When extending:

1. Add a bounded Zod schema and include it in `componentSchemas`.
2. Register the component and its root child reference.
3. Add allowed instructions in the server prompt and update documentation.
4. Test valid/invalid props, a renderer fixture, and keyboard interaction.
5. If adding images or asynchronous internal layout, wait for layout readiness before starting motion. The current curated library has no external assets.

New components are created by the coding skill, not arbitrary runtime code execution. This separates creative authoring from safe live rendering.
