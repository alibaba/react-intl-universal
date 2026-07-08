# UI Inspection Mode

Open this reference when the user asks to inspect, patrol, audit, or QA a running localized UI by page URL.
This mode is for browser-facing localization quality checks, not for normal source-code editing.

## Purpose

Use browser interaction to discover localized UI issues that static source or locale checks cannot prove, especially:

- text truncation;
- text overflow;
- overlapping text or controls;
- visual misalignment caused by translated copy length;
- component visual integrity failures in compact grouped controls, such as segmented controls, tabs, button groups, chip groups, badges, pagination, filter groups, or table action groups that visually break when labels wrap;
- untranslated or hardcoded source-language text;
- raw ICU placeholders such as `{username}`;
- raw rich tags such as `<link>...</link>`;
- inconsistent product terms across nearby screens;
- unnatural copy that does not match the visible product context.

## Inputs

Before starting, identify:

- the page URL or route list to inspect;
- the target locale or language switch behavior;
- the display language for the final `report.html`;
- the expected account, role, tenant, workspace, or test data if the app requires login;
- viewport requirements if the user provides them.

By default, write the final `report.html` in the language used by the user's inspection request. If the user explicitly asks for a report language, use that instead. If the request language is unclear, use English as the fallback default. The inspected UI target locale and the report display language are different concepts: for example, an English UI inspection requested in Chinese should still produce a Chinese `report.html` unless the user asks otherwise.

If the page is inaccessible, blocked by login, or missing test data, record the blocker in the report and ask only for the minimum missing access needed to continue.

## Safety Boundaries

Explore aggressively, but do not perform destructive or irreversible actions unless the user explicitly authorizes a safe test environment.

Avoid confirming actions such as:

- delete, remove, archive, disable, publish, submit payment, send message, invite user, or change production settings;
- final confirmation buttons in dangerous dialogs;
- form submissions that mutate real data.

It is usually safe to open dialogs, menus, popovers, filters, dropdowns, date pickers, pagination, tabs, validation states, and close/cancel flows.
When unsure, capture the state before the risky action and record the untested action as a coverage limitation.

## Exploration Workflow

1. Check the repository `.gitignore` for an existing ignored temporary-output location, such as `tmp/`, `.tmp/`, `temp/`, or another project-specific scratch directory.
2. Create the inspection folder inside that ignored location when possible, for example `tmp/i18n-ui-inspection-YYYYMMDD-HHMMSS/`.
3. If no ignored temporary location is obvious, create `tmp/i18n-ui-inspection-YYYYMMDD-HHMMSS/` and mention in the handoff that the path may need to be added to `.gitignore`.
4. Create a `screenshots/` subfolder inside the inspection folder.
5. Create `inspection-log.md` immediately. This is the raw task log and should be updated while inspecting, fixing, and re-inspecting.
6. Open the user-provided page URL and capture an initial full-page or viewport screenshot.
7. Record the environment in `inspection-log.md`: URL, locale, browser/tool, viewport size, account/role if known, and inspection time.
8. Enumerate visible interactive elements:
   - navigation links;
   - tabs;
   - buttons;
   - segmented controls, button groups, chip groups, badges, and pagination;
   - dropdowns and selects;
   - filters and search inputs;
   - table row actions;
   - pagination;
   - tooltips and hover states;
   - forms and validation states;
   - modals, drawers, popovers, notifications, and confirmation dialogs.
9. For broad page or navigation inspections, create a coverage record for every requested route, menu item, tab, or feature entry before or while inspecting it. The record must include the label, URL/route when known, intended action, coverage status, screenshot path once captured, and notes for blocked or skipped actions.
10. Interact with each safe element or representative group of repeated elements.
11. After each meaningful state change, capture a screenshot and append the action, observed state, screenshot path, and notes to `inspection-log.md`.
12. For every requested route, menu item, tab, or feature entry that is considered covered, capture at least one page/state screenshot. If it has an in-scope detail page, modal, drawer, tab, or representative row action, capture a second screenshot for that detail state when the action is safe.
13. Do not mark a scope item as covered only because a URL was listed in text. It needs screenshot evidence, or it must be marked `blocked`, `skipped-risky`, `external-out-of-scope`, or `not-reached` with a reason.
14. For broad, full-navigation, release-quality, or user-requested high-assurance inspections, run the independent visual review pass after each route/module screenshot set is captured when subagents are available. Keep review close to the captured screenshot set instead of waiting until final report generation.
15. Read each visual review report, triage every observation, and append accepted findings or dismissed observations with rationale to `inspection-log.md`.
16. When a finding is discovered, append the full finding detail, likely root cause, fix recommendation, and acceptance criteria to `inspection-log.md`.
17. If the task includes fixing issues, append each attempted fix and re-inspection result to `inspection-log.md`, including before/after screenshot paths.
18. Handle popups and dialogs by checking their localized text, layout, primary/secondary buttons, close/cancel behavior, and validation messages.
19. If an interaction opens another route, inspect that route if it remains within the user's requested scope.
20. Keep going until the reachable page area has been covered, a blocker is reached, or the user-provided time/scope limit is exhausted.

For repeated controls, sample enough instances to cover different text lengths and states. Do not spend time clicking identical repeated buttons that render the same UI unless their row data changes the text or layout risk.

Do not rely only on DOM overflow metrics such as `scrollWidth > clientWidth`, bounding boxes, or obvious text truncation. These are useful signals, but they do not prove UI-fit. Also inspect screenshots for whether compact components still look like complete components.

### Scrollable Container Triage

Horizontal scrolling is not automatically a UI-fit defect. Many dense tables, tab strips, code panes, metric grids, and wide comparison views are intentionally designed to expose off-screen content through a visible horizontal scrollbar, scroll buttons, trackpad scrolling, or a clear sticky/fixed-column pattern.

Before reporting a cropped table column, hidden tab, fixed-column boundary, or right-side content as an obstruction:

1. Check whether the component has an obvious and usable horizontal-scroll affordance.
2. Scroll it horizontally in both directions when it is safe, then capture the relevant scrolled state if the concern remains.
3. Treat it as normal interaction when all important content and controls can be reached by the intended scroll behavior and the component still behaves coherently.
4. Do not create a finding only because a screenshot at scroll-left does not show every wide-table column, tab, or action.
5. Create a finding only when content remains hidden after scrolling, the scrollbar/scroll buttons are missing or unusable, fixed/sticky columns cover content at reachable scroll positions, the user cannot access a primary action, or translated text breaks the component beyond the intended scrolling pattern.

If an independent reviewer flags a horizontally scrollable area but the primary inspection confirms that scrolling reveals the content normally, dismiss the observation in `inspection-log.md` with that rationale instead of promoting it to an i18n/UI-fit finding.

### Blank Page and Load-Failure Retest

If a route or page state appears blank, mostly white, missing its expected application shell, or stuck with only a global header/loading skeleton, do not immediately classify it as an i18n issue.

Use this retest sequence before creating a finding:

1. Capture the first blank-state screenshot and record the URL, route, locale, viewport, timestamp, and why the page is considered blank or suspiciously incomplete.
2. Wait for late data, route chunks, slow network requests, or module federation remotes to load. Use a concrete wait window, normally at least 10 seconds unless the user supplied a tighter time limit, and record the actual wait duration.
3. Inspect the page body again. Use visible main-content signals, not only hidden DOM text or global shell/header text.
4. If the main content is still blank or suspiciously incomplete, reload the same Chrome/browser tab once with the browser's reload operation. Do not count a hash change, route re-entry, or opening a new tab as this required reload step.
5. After the reload, wait again with a concrete wait window, normally at least 10 seconds, then capture a second screenshot named so the before/after relationship is obvious, for example `operation-check-before-reload.png` and `operation-check-after-browser-reload.png`.
6. Collect lightweight diagnostics when available: console errors/warnings after reload, body text, visible element list, route name, component source reference, and network/API status if the browser tool exposes it safely.
7. Only then classify the item:
   - if the page remains blank after the explicit same-tab reload, record it as a coverage blocker or `page load / blank screen` finding;
   - if the blank state disappears after reload, record a transient load issue in `inspection-log.md`, keep both screenshots as evidence, continue coverage, and do not call it a blocker;
   - if the blank state blocks i18n inspection but is not caused by localization, mark it as an i18n-blocking non-i18n observation.

Report wording must be precise. Do not write "blank page = i18n issue" unless evidence ties the failure to locale loading, missing translations, locale-specific runtime code, or translated data. Prefer:

> The route stayed blank after reload and blocked i18n coverage. This may be a page-load, routing, permission, API, or runtime issue; it is not confirmed as an i18n defect.

## Independent Visual Review Pass

Use the independent review as a second visual QA layer for broad or long Browser Use inspections.

Run an independent screenshot review when any of these is true and subagents are available:

- the user asks for a full navigation, full product, release-quality, patrol, audit, or high-assurance inspection;
- the run has many screenshots, routes, menus, tabs, or detail states;
- earlier inspection evidence suggests subtle visual problems, such as grouped controls, dense filter toolbars, tables, dashboards, or long translated labels;
- the user explicitly asks for a second visual review.

For a narrow single-page quick check, the pass is optional. If it is skipped, say so in `inspection-log.md` and the final report.

### Review Granularity

Do not send the entire run to one reviewer. Split reviews by route, menu module, or small screenshot set so the reviewer has a clean visual context. Prefer one Markdown report per scope item, for example:

```text
visual-reviews/001-workbench.md
visual-reviews/002-asset-health.md
visual-reviews/003-business-health-analysis.md
```

If running several visual reviewers in parallel, keep batches small enough that each reviewer can inspect every screenshot carefully. Reuse the same checklist, but do not include primary-inspection suspected findings unless the review is explicitly a fix verification pass.

### Reviewer Prompt Inputs

Give the reviewer only the minimum task-local evidence:

- target locale and report language;
- route, page, module, viewport, and browser/tool;
- screenshot paths and short captions;
- interaction state, such as "filter drawer open", "row detail panel open", or "language menu open";
- the visual checklist below.

Avoid including primary-inspection conclusions, intended fixes, or suspected bugs. The point is an independent visual read of the screenshots.

### Reviewer Checklist

Ask the reviewer to inspect screenshots for:

- text truncation, clipping, ellipsis that hides important meaning, or text running out of its container;
- unexpected layout overflow, unusable horizontal scroll, cropped controls, or content hidden behind fixed headers/sidebars;
- overlap between text, icons, buttons, inputs, tooltips, badges, tables, and dialogs;
- alignment problems caused by translated text length;
- component visual integrity for tabs, segmented controls, button groups, filter groups, chips, badges, pagination, table action groups, menus, breadcrumbs, and compact dashboards;
- grouped-control wrapping, broken joined borders, wrong first/last radius after wrapping, detached active/selected states, isolated row fragments, or broken icon/text/arrow relationships;
- English words broken in the middle inside table headers, filters, buttons, tabs, menus, badges, pagination, or other compact controls;
- form labels whose colon, required marker, or punctuation is visually detached or orphaned on a separate line;
- untranslated or hardcoded source-language text;
- raw ICU placeholders or rich tags;
- inconsistent terminology, casing, units, dates, numbers, or locale conventions visible in the UI;
- suspicious empty states, validation messages, popovers, tooltips, or dialogs.

DOM overflow being absent is not enough for a pass. The reviewer should judge the screenshot as a product UI, not only as a text container.

Normal scrollable content is also not enough for a finding. If a wide table, tab row, or dense grid is designed to scroll horizontally and the content is reachable after scrolling, report it as normal interaction or an uncertainty for the primary inspector to verify, not as confirmed obstruction.

### Reviewer Markdown Output

The reviewer must write a Markdown report into `visual-reviews/` in the current inspection folder. Use this compact structure:

```markdown
# Visual Review: <scope label>

- Route/state: <url or state>
- Locale/viewport: <locale>, <width>x<height>
- Screenshots reviewed:
  - `screenshots/001-example.png` - <caption>
- Result: no issues | issues found | uncertain

## Findings

### VR-001 <short title>
- Screenshot: `screenshots/001-example.png`
- Category: text overflow/truncation | layout overflow | alignment | component visual integrity | translation quality | untranslated text | raw placeholder/tag | interaction defect
- Severity: critical | high | medium | low
- Confidence: high | medium | low
- Region: <human-readable region, or approximate percentage box if possible>
- Observation: <what is visibly wrong>
- Why it matters: <user impact>
- Suggested fix direction: <translation, layout, component, data/API, or needs investigation>

## Uncertain Items

- <item that needs main-agent Browser Use or product-context verification>
```

The reviewer should prefer concrete observations over broad advice. If no issues are visible, the report still needs a `Result: no issues` line and the screenshot list.

### Primary Inspection Triage

The primary inspection owner makes the final decision. After each visual review report is written:

1. Read it before generating `report.json` or `report.html`.
2. For every reviewer finding, either convert it into an inspection finding or dismiss it with a short rationale in `inspection-log.md`.
3. If a reviewer finding is accepted, assign the normal inspection finding ID, category, severity, owner, fix recommendation, human-attention note, and acceptance criteria.
4. Add red-box annotations when the issue location is not obvious from the screenshot.
5. If the reviewer is uncertain, use Browser Use, DOM inspection, source review, or another screenshot to resolve the uncertainty when it is in scope.
6. When fixing is in scope, re-inspect accepted findings with replacement screenshots.

Reviewer reports are evidence, not final reports. The final `report.json` and `report.html` must reflect the primary-inspection triage status and must not silently drop reviewer observations.

## What to Check

For every page state, inspect both language quality and layout quality.

Language quality:

- Does the copy sound natural in the target locale?
- Does it preserve the product action and business meaning?
- Are terms consistent with nearby modules and previous screens?
- Are labels, button text, empty states, validation messages, tooltips, and dialog copy translated?
- Are ICU variables and rich text tags rendered correctly?

Localized UI quality:

- No text truncation.
- No text overflow.
- No overlap between text, controls, icons, or tooltips.
- No misalignment caused by translated text length.
- Buttons and form controls still have enough padding.
- Tables, filters, tabs, menus, and dialogs remain readable.
- Wide tables, tab strips, and dense grids that are designed for horizontal scrolling remain usable after scrolling. Do not treat content outside the initial scroll-left viewport as obstruction when the intended scrollbar or scroll buttons reveal it normally.
- Compact UI such as placeholders, badges, sidebars, breadcrumbs, and table cells still works.
- English words are not broken in the middle inside compact labels, table headers, buttons, tabs, filters, or form labels. A header such as `Associatio` / `n Range` is a UI-fit failure even when no DOM overflow is detected.
- Form labels do not leave punctuation or required markers visually orphaned. A colon on its own line after a translated label is an alignment/form-label visual-integrity failure.
- Component visual integrity is preserved. For tabs, segmented controls, button groups, filter groups, chip groups, badges, pagination, and table action groups, verify that wrapping does not split one visual group into broken pieces:
  - borders remain continuous where the design expects a joined control;
  - border radius appears only on the outer boundary of the whole control or is reset correctly for a deliberate vertical layout;
  - active/selected state remains visually clear;
  - icons, text, arrows, counters, and dropdown chevrons remain associated with their control;
  - same-group items are not incorrectly split into isolated rows or visually detached buttons;
  - spacing and alignment still communicate one group rather than unrelated controls.

## Finding Triage Workflow

When a check reveals a real issue, turn the observation into a finding. The purpose of triage is to make the report actionable: prioritize the issue, describe the visible problem, classify translation-quality problems only when relevant, route ownership, recommend a fix, and define how to retest it.

Do not run translation-quality classification as a separate inspection pass. Use it only after `What to Check` surfaces a wording-quality issue.

For each finding:

1. Decide whether the observation is related to localization or whether it only blocks localization coverage.
2. Assign severity based on user impact.
3. Choose the primary issue category from the visible symptom.
4. Add a translation quality category only when the problem is about wording quality.
5. Classify the likely root cause and record evidence.
6. Choose a recommended owner.
7. Write the fix recommendation and why that fix should be tried first.
8. Assign fix verification: high, medium, or low.
9. Assign fix risk: high, medium, or low.
10. Record whether human attention is needed, especially when fix verification is low or fix risk is high because of compatibility risk, shared-component side effects, route-family impact, locale-specific risk, or product-copy uncertainty.
11. Write acceptance criteria that can prove the fix worked.

### I18n Relevance Gate

UI Inspection Mode is focused on internationalization and localized UI-fit. Before spending fix effort, classify each observation:

- `i18n-related`: caused or exposed by translated text length, target-locale wording, casing, terminology, missing translation, fallback, ICU/rich-tag rendering, locale-specific data formatting, or language-dependent layout.
- `i18n-blocking`: not proven to be caused by i18n, but it blocks inspection coverage, such as a blank route, login blocker, permission blocker, failing remote module, or API/runtime failure.
- `non-i18n`: visibly unrelated to localization, such as generic product logic, backend data failure, non-localized performance issue, or a layout bug that reproduces independent of language.

Only `i18n-related` findings should drive localization fixes by default. `i18n-blocking` issues may appear in the report as blockers with diagnostics. `non-i18n` observations should be summarized as out-of-scope notes and should not dominate the report or fix plan.

If an observation is not i18n-related, keep the finding title and status explicit, for example `non-i18n observation` or `i18n coverage blocker`, and fill an out-of-scope reason. This prevents the report from treating every product defect as localization debt.

### Severity

Use a severity level that reflects user impact, not only visual obviousness:

- Critical: Blocks a core user flow, prevents users from completing the page's main task, or causes a dangerous/misleading action.
- High: Makes users likely to misunderstand meaning, choose the wrong action, or miss important information.
- Medium: Creates a visible localized UI or language-quality problem, but the user can still understand and complete the flow.
- Low: Minor wording, spacing, alignment, or polish issue with little risk of misunderstanding.

### Primary Issue Category

Choose the category that best explains what the user can see or experience:

- language quality;
- truncation;
- overflow;
- overlap;
- misalignment;
- component visual integrity;
- text wrapping / word-break;
- form label visual integrity;
- untranslated text;
- raw placeholder/tag;
- terminology inconsistency;
- interaction defect;
- page load / blank screen;
- non-i18n observation.

Use `component visual integrity` when a control is technically readable and not overflowing, but no longer looks or behaves as one coherent component. Common subtypes include grouped-control wrapping, broken joined borders, incorrect first/last-item radius after wrapping, detached active states, and icon/text/arrow separation. If a reporting system cannot accept a new category, use `misalignment` and set the subtype or finding title to `grouped-control wrapping/broken border`.

Use `text wrapping / word-break` when translated or target-locale text remains visible but breaks inside a word in a way normal readers would not accept, especially in table headers, compact filter labels, tabs, buttons, menus, chips, badges, and pagination. This is not allowed for ordinary English UI text; fix by increasing width, preventing mid-word breaks, using natural shorter labels, or adding a tooltip as a supplement.

Use `form label visual integrity` when translated form labels no longer align with fields, lose their required marker relationship, or leave punctuation such as `:` orphaned on its own line. This is not allowed even when the field value remains usable. Fix by widening the label column, keeping the label and punctuation together, switching to a top-label layout, or using a shorter label that preserves meaning.

### Translation Quality Category

This field is optional. Fill it only when the primary issue is about wording quality, such as `language quality` or `terminology inconsistency`. Write `N/A` or omit it for pure layout issues such as truncation, overflow, overlap, misalignment, or component visual integrity.

Choose one lightweight MQM-inspired category:

- Accuracy: wrong meaning, missing meaning, or misleading translation.
- Fluency: unnatural grammar, awkward wording, or target-locale readability problem.
- Terminology: inconsistent or incorrect product/domain terms.
- Locale convention: casing, date, number, currency, unit, formality, or other locale-specific convention problem.

Examples:

- A destructive action is translated as a harmless action: Accuracy.
- A sentence is understandable but sounds machine-translated: Fluency.
- The same product object is translated with two different terms nearby: Terminology.
- An English page title uses sentence case where the product uses Title Case: Locale convention.

Keep this lightweight. Do not require a full MQM scorecard during UI inspection. If a translation-quality issue also causes truncation, overflow, overlap, misalignment, or blocks the user flow, prioritize the UI/layout finding and fix recommendation first. Do not recommend a longer or more elaborate translation when it would break the localized UI.

### Fix Verification and Fix Risk

Keep these as separate fields.

Fix verification answers: "How well does the evidence show that this finding is solved or that the recommendation is correct?"

- High: the exact affected UI state was re-inspected, replacement screenshots show the problem is gone, and source review matches the browser evidence.
- Medium: the fix is likely correct, but only representative states were checked, the issue was not fully re-inspected, or some product/context assumptions remain.
- Low: the fix or recommendation is uncertain; human attention is required before treating the finding as resolved.

Fix risk answers: "How likely is this change to create side effects outside the finding?"

- High: the change touches shared components, design-system styles, broad page layout, responsive grid/column allocation, many routes/locales, critical workflows, backend/API contracts, default-locale visual layout, product meaning, or a locale-scoped broad layout branch. Mark human attention as required.
- Medium: the change is scoped but may affect a route family, breakpoint family, related locale, table/form pattern, or neighboring workflow. Human review is recommended.
- Low: the change is local and narrow, such as a small component-level width, spacing, or wrapping adjustment, and is unlikely to affect other layouts, routes, locales, or product meaning.

### Root Cause and Owner

Classify likely root cause as one of:

- frontend application issue: local page code, CSS/layout, component usage, routing, i18n usage, locale wiring, or message composition likely caused the problem;
- backend/API issue: an API response, server-rendered data, missing localized field, malformed placeholder value, permission state, or test data likely caused the problem;
- external dependency issue: a shared frontend component package, module federation remote, design-system package, third-party SDK, browser extension, or hosted asset likely caused the problem;
- unknown or needs investigation: the browser evidence is not enough to assign ownership safely.

Set recommended owner as one of:

- current repository;
- backend/API;
- shared component package;
- module federation remote;
- third-party vendor;
- unknown.

Do not overclaim ownership. Use "likely" language unless the browser evidence clearly proves the cause. Add a short rationale with the evidence used, such as:

- console error or stack trace;
- network request URL, status, and relevant response shape;
- visible component/module boundary if known;
- whether the issue reproduces before or after data loads;
- whether the same text renders correctly in another page state;
- whether the defect appears inside a shared component, remote module, or third-party widget.

### Fix Recommendation

Every finding must include a fix recommendation. If the issue appears fixable in the current repository, choose the smallest change that preserves both language quality and UI quality.

For UI layout issues such as truncation, overflow, overlap, misalignment, or component visual integrity:

1. Prefer improving the target-locale wording first when the translation is unnecessarily long, literal, or awkward.
2. If shorter natural wording would lose important meaning, prefer a small local layout or width adjustment when it solves the issue. This can be low risk when it is component-scoped and does not alter shared layout behavior or unaffected locales.
3. Keep layout changes as small and local as possible. Do not use a broad layout rewrite when a natural target-locale wording change, local width adjustment, or narrower component-level fix would solve the issue.
4. If a broad layout change is truly required, first identify the language or locale where the issue occurs and scope the broad change to that problem language instead of changing unaffected languages.
5. Mark the fix risk as high when the fix changes shared layout behavior, page-level structure, table column allocation, responsive grid rules, locked/fixed columns, default-locale visual layout, or introduces a locale-scoped broad layout branch, even if the target-locale screenshot looks fixed.
6. Prefer general small fixes that work across locales. Use language-specific styles or locale branches only when needed to avoid breaking unaffected languages or the default-locale layout.

When a fix truly needs runtime locale branching, inspect the repository's existing i18n setup before writing the condition. Prefer existing helpers, enums, or stores such as `isEn()`, `isEnglish()`, `getLang()`, `LOCALE.EN_US`, `currentLocale`, or a project-specific locale utility. Add a new local condition only when no reusable project method exists. A fallback such as:

```ts
const isEn = intl?.getInitOptions?.()?.currentLocale?.includes?.('en');
```

is acceptable only as a small, local last resort; do not introduce it when the repository already has a clearer locale helper or exact locale enum.

For table headers and compact labels that break an English word in the middle:

1. Treat the finding as real even when no overflow metric fires.
2. Prefer increasing the relevant column/control width or changing the table's responsive column allocation.
3. Prevent mid-word wrapping where the UI framework allows it.
4. Use a shorter natural label only when it does not reduce meaning or conflict with product terminology.
5. Add a tooltip for full text when the column must stay compact, but do not use tooltip as the only fix if the visible label is unreadable.

For form labels whose punctuation, colon, or required marker becomes visually detached:

1. Prefer increasing the form label column width or switching that form area to a top-label layout.
2. Keep label text, required marker, and colon/punctuation visually bound as one label unit.
3. If the long label repeats nearby context, consider a shorter label such as `Owner` only when the surrounding section heading already supplies the missing context.
4. Avoid per-locale CSS unless a general form layout fix would create broader regressions.

For segmented controls, tabs, button groups, chip groups, pagination, and table action groups:

1. Do not treat free wrapping inside a joined visual group as safe merely because there is no overflow.
2. Prefer keeping same-group items on one row, allowing the whole group to move to a new row, or using an explicit grid that preserves group boundaries.
3. If the group must become multi-line, implement a deliberate vertical or multi-row grouped-control style with correct borders, radius, active states, and separators for every position.
4. If space remains constrained, consider increasing the container width, shortening natural target-locale labels without losing meaning, or replacing the group with a select/dropdown.

For translation quality issues:

1. Translate by product meaning, not word-by-word.
2. Use visible UI context, nearby source code, route/module context, validation logic, and adjacent labels to infer the intended user action and business meaning.
3. If the user provides supporting material such as a glossary, terminology guide, product documentation, or design copy, follow it when it improves accuracy.
4. In the recommendation, mention the evidence used for the wording choice, such as a provided glossary, industry/common terminology, or current repository business context.

For issues that do not appear fixable in the current repository, recommend the next owner or investigation path instead of proposing a local code change. Examples include backend/API payload changes, shared component package fixes, module federation remote fixes, or third-party widget limitations.

### Acceptance Criteria

Write observable retest steps for every finding. Include the same URL, locale, viewport, user action, and expected visual or language result. When the issue had screenshot evidence, the acceptance criteria should ask for a replacement screenshot after the fix.

## Screenshot Requirements

The inspection artifacts must include all screenshots captured during the inspection.
Use stable, numbered filenames such as:

```text
screenshots/001-initial-page.png
screenshots/002-open-language-menu.png
screenshots/003-dialog-validation.png
screenshots/004-issue-overflow-filter-label.png
```

Every screenshot should have a short caption in `inspection-log.md` while inspecting. When the final report is generated, include the same caption context in `report.html`:

- what page or state it shows;
- what action produced it;
- whether it is normal coverage evidence or issue evidence.

After every screenshot capture, verify the screenshot file exists and has a plausible non-zero size before using it as evidence. If the browser tool returns screenshot bytes, prefer explicitly writing those bytes and then checking the file. Record screenshot-write failures in `inspection-log.md`; do not mark a route as covered with a missing or zero-byte screenshot.

For broad route, menu, or full-product inspections, maintain a screenshot manifest in `inspection-log.md` as a table or compact list. Each row should map one coverage item to its screenshot evidence:

- scope label, such as a menu item, tab, route, or detail state;
- URL/route or page state;
- action taken;
- screenshot path;
- status: `covered`, `blocked`, `skipped-risky`, `external-out-of-scope`, or `not-reached`;
- short note.

The final `report.html` must reproduce this coverage evidence. Do not only show issue screenshots or a few "important" screenshots when the user asked for a broad inspection; the reader must be able to audit which pages were actually opened.

In `report.html`, screenshot evidence must be visible inline, not only as text links. Follow the wireframe for screenshot presentation and preview behavior. Keep the original image `href` as a no-JavaScript fallback, and do not require new npm packages, external CDNs, or separate viewer files for core screenshot review.

When the issue location is not obvious from the screenshot, add red-box annotations to point at the relevant UI region:

- store annotation boxes as percentages relative to the original screenshot's natural pixel dimensions, using `x`, `y`, `width`, and `height` values from `0` to `100`;
- calculate percentages from the original screenshot pixels, for example `x = leftPx / naturalWidth * 100`; do not estimate coordinates from a scaled thumbnail, a cropped preview, or the current browser viewport unless you convert them back to the original screenshot dimensions;
- use a short label such as "truncated label", "broken border", "wrong unit", or "untranslated text";
- render that label visibly in `report.html`, either as a small callout attached to the red box or as a nearby caption. Do not hide the explanation only in `title`, `alt`, or the surrounding prose;
- keep the original screenshot file unchanged; render the red boxes as `report.html` overlays by default;
- render the same annotation boxes in thumbnail/image-card views and in the enlarged lightbox preview;
- for before/after evidence, annotate the problem region in the before screenshot and the corresponding verified region in the after screenshot;
- keep annotation styling visible but non-obscuring: prefer a thin red border, minimal halo/shadow, and enough box padding so the border does not cover the exact text or UI defect;
- do not require new npm packages for default report generation. If an environment already has an image tool such as `sharp`, optionally generate additional annotated PNGs, but keep the original screenshots and the HTML overlay as the portable source of truth.

When an issue is found, capture the smallest screenshot that clearly shows the problem. If context matters, also include a wider screenshot.

### Screenshot Annotation Rendering Contract

Red-box annotation coordinates are only trustworthy when the overlay is rendered in the same coordinate space as the image itself. The report generator must use an annotated image stage whose layout is defined by the screenshot image, not by an unrelated card, fixed ratio wrapper, or cropped thumbnail.

Use this safe pattern for finding evidence and annotated screenshot appendix items:

```html
<figure class="annotated-shot">
  <a class="annotated-stage" href="screenshots/004-example.png" data-preview="screenshots/004-example.png">
    <img src="screenshots/004-example.png" alt="..." />
    <span class="redbox" style="left:10%;top:20%;width:30%;height:8%"><em>truncated label</em></span>
  </a>
  <figcaption>truncated label - the filter text is clipped</figcaption>
</figure>
```

```css
.annotated-stage { position: relative; display: block; }
.annotated-stage img { display: block; width: 100%; height: auto; }
.annotated-stage .redbox { position: absolute; box-sizing: border-box; border: 2px solid #e11d48; }
```

For the enlarged preview, use the same rule: place the image and red boxes inside a single positioned stage, let the image's rendered size define the stage, and render red boxes relative to that stage. The stage may be constrained by `max-width` or `max-height`, but the image must scale uniformly and the overlay must scale with it.

Do not use these patterns for annotated finding screenshots unless you explicitly compensate for the image's rendered offset and scale:

- a fixed thumbnail ratio such as `aspect-ratio: 16 / 9` around screenshots with different natural ratios;
- `object-fit: contain` or `object-fit: cover` on the image while positioning red boxes against the outer wrapper;
- cropped thumbnails that hide part of the original screenshot while still showing original screenshot-relative boxes;
- positioning red boxes against the card, figure, page, viewport, or lightbox backdrop instead of the rendered image stage.

If the report needs uniform thumbnail heights for the screenshot appendix, it may use cropped thumbnails only when there are no annotations on that thumbnail. Annotated finding cards should preserve the screenshot's natural aspect ratio, or use an inner image stage with the exact screenshot aspect ratio.

After generating `report.html`, verify at least one annotated finding screenshot in both the inline card and the enlarged preview. A DOM check that `.redbox` exists is not enough; visually confirm the box surrounds the intended UI region and that the visible label explains what the reader should look at.

## Inspection Artifacts

Write all inspection artifacts to the inspection folder. Prefer a folder under the repository's ignored temporary-output location found from `.gitignore`.
The final folder shape is:

```text
tmp/i18n-ui-inspection-YYYYMMDD-HHMMSS/inspection-log.md
tmp/i18n-ui-inspection-YYYYMMDD-HHMMSS/screenshots/
tmp/i18n-ui-inspection-YYYYMMDD-HHMMSS/visual-reviews/
tmp/i18n-ui-inspection-YYYYMMDD-HHMMSS/report.json
tmp/i18n-ui-inspection-YYYYMMDD-HHMMSS/report.html
```

At the start and during the middle of inspection, only the working artifacts should exist: `inspection-log.md`, `screenshots/`, and, when independent visual review is used, `visual-reviews/`.

During active inspection, create and maintain only these artifacts:

- `inspection-log.md`: raw chronological task log. Update this while inspecting, fixing, and re-inspecting.
- `screenshots/`: all screenshots captured during inspection, fixing, and re-inspection.
- `visual-reviews/`: independent screenshot-review Markdown reports written by visual-review subagents, plus triage references in `inspection-log.md`.

Do not create `report.json` or `report.html` while inspection is still in progress. These files are final-report artifacts, not live working notes.

Generate `report.json` and `report.html` only after one of these completion conditions is met:

- the requested inspection scope has been covered;
- all in-scope fixes and re-inspection have been completed;
- inspection is blocked and cannot meaningfully continue;
- the user explicitly asks to stop and generate the final report.

## Inspection Task Log

`inspection-log.md` is the raw source of truth for the run. It should be useful even before the final reports are generated.

Update it during the task with:

- environment: inspected URL/routes, locale, browser/tool, viewport, account/role if relevant, and inspection start time;
- chronological actions: what was opened, clicked, typed, hovered, or closed;
- observed state after each meaningful action;
- screenshot path for each meaningful state;
- blockers, skipped risky actions, and untested areas;
- independent visual review report paths, reviewer result status, and primary-inspection triage decision for each reviewer observation;
- finding details as soon as an issue is discovered;
- root-cause reasoning and evidence;
- fix recommendation, fix verification, fix risk, human-attention reason, and acceptance criteria;
- fix attempts, code or configuration areas touched when known, concise relevant code diffs, re-inspection result, and after-fix screenshots when fixing is in scope.

The log does not need polished prose. Do not delete failed fix attempts or earlier observations when they explain the final recommendation.

## Final Report Generation

Generate `report.json` and `report.html` only after an inspection completion condition is met. Do not generate them at the start of UI Inspection Mode or while browser exploration, fixing, or re-inspection is still active.

Completion conditions are:

- the requested inspection scope has been covered;
- all in-scope fixes and re-inspection have been completed;
- inspection is blocked and cannot meaningfully continue;
- the user explicitly asks to stop and generate the final report.

### `report.json`

`report.json` is for statistics, dashboards, CI summaries, and follow-up automation. It should not introduce facts that are absent from `inspection-log.md` or screenshots. The root object must use the `I18nUiInspectionReportJson` interface from [UI Inspection Report Types](ui-inspection-report-types.ts).

When adding red-box annotations for screenshots, write them to `screenshotAnnotations` in `report.json`. Use screenshot-relative percentage coordinates so the same data can be rendered across report views without recalculating for each display size.

When independent visual review is used, write review evidence to `visualReviewReports` in `report.json`. Each entry should point to the Markdown report in `visual-reviews/`, list the screenshots reviewed, and state how reviewer observations were triaged. If the pass was skipped or unavailable for a broad inspection, state that limitation in `inspection-log.md` and `report.html` instead of pretending screenshot coverage equals independent review coverage.

When a finding is about component visual integrity, set `category` to `component visual integrity` and include a concise subtype when useful, such as `grouped-control wrapping/broken border`. If a legacy consumer cannot handle that category, mirror the subtype in the finding title or human-readable notes while keeping the visible issue clear in `report.html`.

For every finding, write both `fixVerification` and `fixRisk`. `fixVerification` is about whether the fix or recommendation solves the visible issue; `fixRisk` is about possible side effects. Older reports may contain a deprecated `fixConfidence` field with the same meaning; new reports should use `fixVerification`. When local source, style, config, or locale files were changed for a finding, write concise relevant non-empty hunks to `fixEvidence.codeDiffs`. Omit `fixEvidence.codeDiffs` when no local source/style/config/locale file changed or when there is no meaningful diff hunk. Do not dump unrelated diffs into the report.

### `report.html`

`report.html` is the human-readable final report. Use [UI Inspection Report Wireframe](ui-inspection-report-wireframe.html) as the structural and interaction reference instead of rewriting the report layout from prose. The wireframe is not a required visual theme or component library, and its sample data must not be copied into real reports.

Choose the `report.html` display language before writing the file:

- use the language of the user's inspection request by default;
- use a user-specified report language when provided;
- use English as the fallback default when the request language is unclear;
- do not infer the report language from the inspected UI target locale;
- localize report headings, dashboard labels, prose, finding explanations, table headers, screenshot captions, status labels, validation notes, blocker text, and lightbox controls;
- keep product names, locale codes, URLs, file paths, commands, finding IDs, key names, and code identifiers unchanged when translating them would reduce precision.

The wireframe defines the expected report information architecture and default interactions. Keep detailed visual, layout, and interaction choices in the wireframe. This document only defines the durable report contracts below:

- Include the requested scope, locale, viewports, browser/tool, coverage status, visual-review status, blockers, skipped areas, and every accepted finding from `inspection-log.md` and `report.json`.
- Keep blockers and non-i18n observations visually separate from normal i18n/UI-fit findings.
- Distinguish text overflow/truncation, layout overflow, alignment, and component visual integrity. Do not summarize the result as only "No visible overflow found".
- Use screenshot annotation data from `report.json` and preserve coordinate alignment in cards, modals, appendices, and enlarged previews.
- Show concise code diffs only for findings with local source, style, config, or locale changes. Omit empty diff blocks.
- Keep the feedback-copy behavior: copy only findings whose feedback textarea is not empty after trimming whitespace. Use one blank line between findings, formatted as:

```text
Finding I18N-010: This should be fixed by increasing the column width.

Finding I18N-012: Please fix. Prefer increasing the label column width.
```

- If every feedback textarea is empty, show a localized "no feedback to copy" status instead of copying blank findings.
- Ensure local `file://` report interactions work without new npm packages. External CDNs are optional only when the report also has a local fallback.
- Preserve modal stack behavior from the wireframe. If a finding-detail modal is open and the user opens an image preview/lightbox from inside it, pressing `Escape` must close only the topmost image preview. A second `Escape` may then close the underlying finding-detail modal.

Report interaction JavaScript must be generated defensively:

- Prefer static JavaScript that reads values from DOM attributes or `<script type="application/json">` data blocks. Keep dynamic report strings out of executable JavaScript when practical.
- When executable JavaScript must contain generated strings, serialize them with `JSON.stringify(...)` or an equivalent safe string literal emitter. Do not hand-concatenate unescaped finding titles, labels, screenshot paths, feedback text, or copied text templates into JavaScript source.
- For copy-feedback text, build the separator in runtime JavaScript as `'\n'`, `String.fromCharCode(10)`, or a value produced by `JSON.stringify('\n')`. Never generate a quoted JavaScript string that contains a literal newline.
- Treat one inline-script syntax error as a report blocker because it can disable multiple report interactions together.
- After writing `report.html`, run this no-dependency syntax smoke test before opening or handing off the report:

```bash
REPORT_HTML=tmp/i18n-ui-inspection-YYYYMMDD-HHMMSS/report.html
node - "$REPORT_HTML" <<'NODE'
const fs = require('fs');
const vm = require('vm');
const file = process.argv[2];
const html = fs.readFileSync(file, 'utf8');
let count = 0;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  const attrs = match[1] || '';
  if (/type=["']application\/json["']/i.test(attrs)) continue;
  count += 1;
  new vm.Script(match[2], { filename: `${file}#script-${count}` });
}
console.log(`checked ${count} executable script(s)`);
NODE
```

The final report must not make the user open the screenshots folder just to know whether the requested scope was covered. If every screenshot is saved on disk but the HTML report omits the complete coverage matrix or screenshot appendix, the report is incomplete.

If no issues are found, still generate `report.html`, include process screenshots for all covered scope items, and state what was actually verified. Do not write only "No visible overflow found" as the final result. Distinguish at least text overflow/truncation, layout overflow, alignment, and component visual integrity. If the run only checked overflow metrics or screenshots for obvious truncation, state that component visual integrity was not fully verified.

If independent visual review was used and no issues were accepted, state that visual-review observations were triaged and no findings remained. If reviewer observations were dismissed, include the dismissal rationale in the independent visual review appendix.

Before handing off, open the generated `report.html` when possible and verify representative wireframe interactions. Also verify there are no JavaScript syntax errors, red-box annotations are visually aligned in at least one normal and enlarged report view, nested modal `Escape` behavior closes only the topmost modal, empty code-diff blocks are omitted, and any scroll-to-top behavior changes the actual scroll container rather than only calling `window.scrollTo`.

## Finding Details

For each issue, include:

- ID, severity, and title;
- affected URL/state;
- target locale and viewport;
- reproduction steps;
- expected result;
- actual result;
- screenshot link;
- i18n relevance: `i18n-related`, `i18n-blocking`, or `non-i18n`;
- out-of-scope reason when the issue is non-i18n or only blocks i18n coverage;
- visual review evidence when relevant, such as `visual-reviews/003-business-health-analysis.md` and reviewer finding ID `VR-001`;
- likely category: language quality, truncation, overflow, overlap, misalignment, component visual integrity, text wrapping / word-break, form label visual integrity, untranslated text, raw placeholder/tag, terminology inconsistency, interaction defect, page load / blank screen, or non-i18n observation;
- component visual integrity subtype when relevant, such as `grouped-control wrapping/broken border`;
- translation quality category: Accuracy, Fluency, Terminology, Locale convention, or N/A for pure layout issues;
- likely root cause: frontend application issue, backend/API issue, external dependency issue, or unknown/needs investigation;
- root-cause evidence: one or two concise observations supporting the classification;
- recommended owner: current repository, backend/API, shared component package, module federation remote, third-party vendor, or unknown;
- fix recommendation: the concrete change to try first, or the owner/investigation path if it is not fixable in the current repository;
- fix priority/rationale: why this recommendation comes before other options, such as shortening a translation before changing CSS.
- fix verification: high, medium, or low;
- fix risk: high, medium, or low, with a short side-effect or compatibility explanation;
- fix diff: concise relevant unified diff hunks for source/style/config/locale changes made for this finding. In `report.html`, omit the diff block entirely when no local code change was made or when no non-empty diff hunk exists; in `inspection-log.md`, `N/A` is acceptable text for no local code change;
- human attention: whether human review is needed, why, and any side-effect or compatibility risk;
- acceptance criteria: the exact retest steps or observable conditions that confirm the issue is fixed.

Use these lifecycle statuses for the matching `report.json` finding:

- `open`: the issue is still present and has not been fixed.
- `fixed`: a fix was made, but the exact UI state has not been re-inspected yet.
- `verifiedFixed`: the fix was re-inspected and confirmed with replacement screenshot evidence.
- `deferred`: the issue is real, but the team postponed it.
- `wontFix`: the issue is real, but the team does not plan to fix it.
- `needs-product-confirmation`: the observation may be real, but product/data ownership or expected behavior must be confirmed before fixing.
- `non-i18n`: the issue is outside the i18n/UI-fit scope. Include it only when it blocks coverage or is useful context, and do not let it dominate the report.

Example:

```text
#### I18N-001 [High] Filter button text overlaps the icon

- URL/state: `https://example.com/orders`, advanced filter drawer open
- Locale/viewport: German, 1280x800
- Steps: Open page, click "Advanced filters", select "Delivery status".
- Expected: Button label and icon remain separated.
- Actual: The translated label overlaps the chevron icon.
- Screenshot: [004](screenshots/004-filter-overlap.png)
- Category: overlap
- Translation quality category: N/A
- Likely root cause: frontend application issue
- Root-cause evidence: The API returned the expected translated label, and the overlap happens inside the page's local filter button layout after the text is rendered.
- Recommended owner: current repository
- Fix recommendation: First review whether the German label can be shortened naturally without losing meaning. If not, allow the button label to wrap or increase the button min-width with a shared responsive rule.
- Fix priority/rationale: Text refinement is lower risk for compact UI when the wording is unnecessarily long; use a general layout fix next because this button may receive long labels in multiple locales.
- Fix verification: medium
- Fix risk: medium, because a layout change to compact filter buttons may affect neighboring table filters.
- Fix diff: `src/pages/orders/FilterBar.module.css`
  `@@`
  `-.filterButton { white-space: nowrap; }`
  `+.filterButton { white-space: normal; }`
- Human attention: Review the shared filter button usage before treating this as fully safe, because a min-width or wrapping change could affect compact table filters in other routes.
- Acceptance criteria: Reopen `https://example.com/orders` at 1280x800 in German, open the advanced filter drawer, select "Delivery status", and confirm the button label and chevron no longer overlap. Capture a replacement screenshot.

#### I18N-002 [Medium] Segmented control wraps into broken visual fragments

- URL/state: `https://example.com/assets`, filter toolbar visible
- Locale/viewport: English, 1280x800
- Steps: Open the page and inspect the tag-type segmented control.
- Expected: The grouped control remains visually joined, with continuous borders, radius only on the whole control's outer corners, and a clear selected state.
- Actual: The third segment wraps to a second line. Text is readable and no DOM overflow is reported, but the border/radius rules make the wrapped item look like an isolated button.
- Screenshot: [005](screenshots/005-segmented-control-wrap.png)
- Category: component visual integrity
- Component visual integrity subtype: grouped-control wrapping/broken border
- Translation quality category: N/A
- Likely root cause: frontend application issue
- Root-cause evidence: The control uses a wrapping flex row with joined-border styling intended for a single horizontal row.
- Recommended owner: current repository
- Fix recommendation: Prevent free wrapping inside the visual group, allow the whole group to move to a new row, use an explicit grid, or implement a deliberate vertical segmented-control style with corrected per-position borders/radius. If space remains constrained, consider a select/dropdown.
- Fix priority/rationale: This is a component-integrity issue, not a translation-quality issue; shortening text is optional only if it preserves meaning and product terminology.
- Fix verification: medium
- Fix risk: high, because changing grouped-control wrapping behavior may affect shared segmented controls and filter toolbars.
- Fix diff: `src/pages/assets/SegmentedGroup.module.css`
  `@@`
  `-.segmentedGroup { display: flex; flex-wrap: wrap; }`
  `+.segmentedGroup { display: inline-grid; grid-template-columns: repeat(3, max-content); }`
- Human attention: Review neighboring toolbar breakpoints because the fix may affect compact filter layouts.
- Acceptance criteria: Reopen the same URL/locale/viewport and confirm the segmented control is either one coherent horizontal group or a deliberate vertical/grouped layout, with no broken borders or detached active states. Capture a replacement screenshot.
```

## Final Handoff

When reporting back to the user, include:

- the `inspection-log.md` path;
- the `report.json` path;
- the `report.html` path;
- the screenshot folder path;
- the `visual-reviews/` folder path and independent visual-review status when that pass was used, skipped, unavailable, or only partially completed;
- a short issue summary;
- any high-risk fixes or low-verification fixes that need human review;
- any blockers or untested risky actions.

Do not paste every screenshot into the chat unless the user asks. The durable artifacts should be the complete source of evidence.
