// Design/interaction guidance adapted from upstream prompt-options.ts. MIT; see LICENSE.
import type { PromptOptions } from '@openuidev/react-lang';
import { demoToolSpecs } from './demo-data';
import { exampleShoppingList, exampleSteps, exampleDashboard } from './examples';

export const promptOptions: PromptOptions = {
  bindings: true,
  tools: demoToolSpecs,
  additionalRules: [
    'Compose the answer as a useful page: Title, short Text, then meaningful blocks. Use Row and Grid for comparisons, Badge for facts, Card only to group a block, and Popover for an aside. Prefer Col as root; Showcase remains available for the four original cards.',
    'Use a three-tier spacing system: inner gap 1–2 (4–8px), group gap 3–4 (12–16px), section 24px. Leave the root Col and Card gaps unset to use defaults. Use compact headings and short body text inside cards; align the content structure of adjacent cards.',
    'Make numbers, choices, lists and steps work locally: keep inputs in $variables, derive displays with the listed @functions, and change state with @Set. Do not send another model request for something the UI can compute.',
    '$variable defaults must be literals (numbers, strings, lists or objects). Use @Append, @Remove, @RemoveAt, @Update for lists and @Toggle/@Includes for selections. Never define functions or execute JavaScript.',
    'Use cond ? a : b for conditional text/components; there is no @If. Derive rows once with @Each(list, "x", {...}) and reuse rows in Table, Chart and @Sum(rows.field). Do not nest @Each bodies; keep repeated UI small and bound @Range to at most 256 entries.',
    'Use Chart for numeric comparisons/time series; Table for precise values; Svg with labeled primitives for geometry and how-to steps; Flashcard for learning. Keep SVG drawings simple with a viewBox around 240 wide, about a dozen shapes, labels and arrowheads. There is no HtmlView, Map, Image, SearchImage, YouTube or external navigation.',
    'Use @Format for currency/percent/large values, @Plural for counts, @FormatDate for dates. Relative dates start at @Today(). Use @DaysBetween for date order. Call @Random, @Pick and @Shuffle inside @Set so random values are drawn once per click.',
    'Read numeric inputs through @Default and @Clamp with sensible bounds. Preserve missing values and units; never describe synthetic figures as live data. Chart inherits upstream limitations: stacked charts do not represent negative contributions faithfully; use unstacked views instead.',
    'Only Query("get_orders"|"get_tickets"|"get_traffic", {days: 1..90}, {rows: []}) is available. These are LOCAL SYNTHETIC DATA providers, not databases or network tools. Always visibly label their data as synthetic/sample. No refresh interval, Mutation, @Run, or arbitrary tool names.',
    'Allow only local @Set/@Reset and explicit click-triggered @CopyToClipboard/@ToAssistant actions. Never put external actions on Timer completion. @ToAssistant fills the chat composer for user review; it does not send automatically. Include necessary chosen values in its short message; full form state is not sent automatically.',
    'Keep statement names and legacy widget ids stable across edits. Each new assistant reply has independent state; do not claim that unsent local choices were seen by the model. Earlier replies are not modified.',
    'Use only registered components, functions and bounded props. Programs must be complete, at most 18,000 characters and 160 statements, with no orphan statements. No arbitrary HTML/CSS, scripts, external resources or model-authored functions. Links inside text are inert.',
  ],
  examples: [exampleShoppingList, exampleSteps],
  toolExamples: [`Synthetic local dashboard (not live data):\n${exampleDashboard}`],
};
