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

## Current Source Risk Scan

When the current frontend repository is available, use the current source tree to build a risk checklist before or alongside browser exploration. This scan does not replace browser inspection; it tells the browser pass where subtle localized UI-fit failures are likely.

Record the scan summary in `inspection-log.md`, including searched patterns, important matches, and the page states where each match should be verified. Prioritize source matches that correspond to the current page, route family, or visible feature entry.

Use `rg` first. Search for high-risk localized UI patterns such as:

- narrow fixed widths: `width: 40px`, `width: 50px`, `width: 80px`, fixed action-column widths, compact inline styles, and CSS variables used as narrow control widths;
- form labels: `.form-item-label`, `.dc-form-item-label`, `labelCol`, `labelWidth`, required-marker or colon rendering, and label grids;
- table action areas: `fixed: 'right'`, `fixed="right"`, `lock="right"`, action columns, row-action menus, and table-column `width` values;
- clipping and wrapping constraints: `ellipsis`, `text-overflow`, `overflow: hidden`, `white-space: nowrap`, `word-break`, `line-clamp`, and compact tooltip-only labels;
- grouped controls: tabs, segmented controls, button groups, chip groups, badges, pagination, filter groups, and `flex`/`inline-flex` with `flex-wrap`, collapsed borders, first/last-child radius rules, or active-state styling;
- long target-locale candidates: placeholders, table headers, button labels, menu items, status labels, empty states, validation messages, tooltip/help text, and product-defined enum display names.

For unexpected-language text, source search is required by the origin-triage workflow. For UI-fit issues, source risk scan is a targeting aid: a source match becomes a finding only after browser or screenshot evidence shows a visible problem.

## Default Scope And Coverage Strategy

When the user provides a page URL and asks for inspection, patrol, audit, or QA without saying "only inspect the current tab/state", treat the reachable product area around that URL as in scope. Do not interpret the URL as permission to inspect only the default active tab.

Include reachable, non-destructive entries such as:

- app-shell primary and secondary navigation inside the same product/workspace area;
- left sidebar menu items, side tabs, tree nodes, accordion sections, and page-level tab strips;
- top navigation tabs, feature cards, dashboard modules, toolbar dropdowns, and safe settings/detail entry points;
- representative table row actions, detail drawers, modals, filters, and popovers.

Use an inventory-driven depth-first inspection pass:

1. Build a coverage inventory from visible navigation, sidebars, tab strips, and feature entry points.
2. Pick the next safe first-level tab/menu/feature entry from the inventory, open it to its initial state, and capture screenshot evidence.
3. Before declaring that entry covered, inspect its safe child tabs, submenus, feature entries, and representative second-layer controls such as filters, primary actions, row actions, drawers, and validation states.
4. Then return to the inventory and repeat the same depth-first inspection for the next first-level entry.
5. If there are too many items for the user-provided time or scope, prioritize distinct modules and visible high-risk localized UI, then mark the rest `not-reached`, `duplicate-sampled`, `skipped-risky`, or `blocked` with reasons. Do not silently omit them.

If a page has a left sidebar or tab strip and only the first active item was inspected, coverage is partial by definition unless every other visible item is risky, blocked, external, or explicitly out of scope.

## Exploration Workflow

1. Check the repository `.gitignore` for an existing ignored temporary-output location, such as `tmp/`, `.tmp/`, `temp/`, or another project-specific scratch directory.
2. Create the inspection folder inside that ignored location when possible, for example `tmp/i18n-ui-inspection-YYYYMMDD-HHMMSS/`.
3. If no ignored temporary location is obvious, create `tmp/i18n-ui-inspection-YYYYMMDD-HHMMSS/` and mention in the handoff that the path may need to be added to `.gitignore`.
4. Create a `screenshots/` subfolder inside the inspection folder.
5. Create `inspection-log.md` immediately. This is the raw task log and should be updated while inspecting, fixing, and re-inspecting.
6. Open the user-provided page URL and capture an initial full-page or viewport screenshot.
7. Record the environment in `inspection-log.md`: URL, locale, browser/tool, viewport size, account/role if known, and inspection time.
8. Build the initial coverage inventory from visible interactive elements:
   - primary and secondary navigation links;
   - left sidebar items, tree nodes, accordion sections, and side tabs;
   - top tabs and page-level tabs;
   - feature cards, dashboard modules, and safe detail/setup entry points;
   - buttons;
   - segmented controls, button groups, chip groups, badges, and pagination;
   - dropdowns and selects;
   - filters and search inputs;
   - table row actions;
   - pagination;
   - tooltips and hover states;
   - forms and validation states;
   - modals, drawers, popovers, notifications, and confirmation dialogs.
9. For every requested or discovered in-scope route, menu item, tab, or feature entry, create a coverage record before or while inspecting it. The record must include the label, URL/route when known, intended action, coverage status, screenshot path once captured, and notes for blocked or skipped actions.
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

### Safe Interaction Depth Contract

For each reachable route, menu item, tab, or feature entry in scope, cover more than the initial page state unless access, data, or safety boundaries prevent it. At minimum, attempt and log these layers:

1. Initial state: capture the loaded page or tab state.
2. Filters: open representative dropdowns, selects, date pickers, segmented controls, or search inputs. If several control types exist, sample different types.
3. Primary action: open create, configure, edit, or setup entry points to a safe state without final submission.
4. Row action: open a representative row action menu, detail drawer, detail route, or safe inline action.
5. Table behavior: check pagination, page-size controls, horizontal scroll, fixed/locked columns, and hover-revealed row actions when present.
6. Help and transient UI: sample a tooltip, help popover, hover state, notification, drawer, or modal close/cancel flow.
7. Empty, validation, disabled, or loading state: trigger one safe state when it is available without mutating real data.

For each safe control or representative control group, write one of these coverage decisions in `inspection-log.md` and `report.json` coverage evidence:

- `covered`: interacted with or visually inspected and screenshot evidence exists;
- `skipped-risky`: skipped because the next action could mutate data or produce irreversible side effects;
- `duplicate-sampled`: skipped after a representative repeated control with the same rendering pattern was covered;
- `blocked`: blocked by access, loading, permission, missing test data, or runtime/API failure;
- `not-reached`: in scope but not reached before the run stopped.

If a route has only an initial screenshot and no safe second-layer interaction, mark that route as partial coverage unless the page truly has no safe interactive controls. The final report must list the untested safe interactions instead of implying full coverage.

### Scrollable Container Triage

Horizontal scrolling is not automatically a UI-fit defect. Many dense tables, tab strips, code panes, metric grids, and wide comparison views are intentionally designed to expose off-screen content through a visible horizontal scrollbar, scroll buttons, trackpad scrolling, or a clear sticky/fixed-column pattern.

Before reporting a cropped table column, hidden tab, fixed-column boundary, or right-side content as an obstruction:

1. Check whether the component has an obvious and usable horizontal-scroll affordance.
2. Scroll it horizontally in both directions when it is safe, then capture the relevant scrolled state if the concern remains.
3. Treat it as normal interaction when all important content and controls can be reached by the intended scroll behavior and the component still behaves coherently.
4. Do not create a finding only because a screenshot at scroll-left does not show every wide-table column, tab, or action.
5. Create a finding only when content remains hidden after scrolling, the scrollbar/scroll buttons are missing or unusable, fixed/sticky columns cover content at reachable scroll positions, the user cannot access a primary action, or translated text breaks the component beyond the intended scrolling pattern.

If an independent reviewer flags a horizontally scrollable area but the primary inspection confirms that scrolling reveals the content normally, dismiss the observation in `inspection-log.md` with that rationale instead of promoting it to an i18n/UI-fit finding.

For tab strips and other scrollable grouped controls, treat a working scroll affordance as normal product behavior unless there is a concrete visual-integrity failure. Before promoting a tab strip to a normal `I18N-xxx` finding, record:

- the visible tab labels before scrolling and after scrolling;
- whether the active indicator, scroll buttons, and tab labels still belong to one coherent tab strip;
- whether any tab label or primary adjacent control is overlapped, clipped, or unreachable after using the intended scroll buttons;
- if source changes are attempted, the before/after visible tab capacity, such as visible tab count or visible label range, at the same viewport and scroll position.

Do not fix a scrollable tab strip merely to expose more off-screen tabs when its scroll buttons work. Do not mark a tab-strip fix as `verifiedFixed` if the after screenshot shows fewer visible tabs, a narrower visible label range, worse overlap, or more reliance on scrolling than the before screenshot.

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

Only `i18n-related` findings should receive normal `I18N-xxx` finding IDs and drive localization fixes by default. `i18n-blocking` issues may appear in the report as blockers with diagnostics, but they must be visually separate from normal findings and must not be counted as fixed i18n issues. `non-i18n` observations should be summarized as out-of-scope notes and should not dominate the report or fix plan.

Do not promote business-logic, backend-data, permission, routing, calculation, workflow-state, or generic product defects to normal `I18N-xxx` findings unless there is direct evidence that the issue is caused or exposed by localization. A raw key, ID, enum value, or internal-looking token is not automatically an i18n bug: first determine whether it is frontend product copy under locale ownership or business/API metadata. If it is backend/domain data or expected product behavior, classify it as `non-i18n` or `needs-product-confirmation` and do not fix it as part of UI Inspection Mode unless the user explicitly asks.

If an observation is not i18n-related, keep the title and status explicit, for example `non-i18n observation`, `needs product confirmation`, or `i18n coverage blocker`, and fill an out-of-scope reason. This prevents the report from treating every product defect as localization debt.

### Unexpected Language Origin Triage

When a target-locale page shows text in an unexpected language, such as Chinese text in an English UI, do not classify it only from the visible text. First determine whether the text is frontend product copy, locale fallback, backend/API product copy, user-created data, external module metadata, or unknown.

For each unexpected-language observation:

1. Capture the UI evidence: screenshot, URL or route, viewport, target locale, interaction state, visible text, nearby labels, and component context. When browser tooling exposes it safely, record the DOM text or stable selector around the observed text.
2. Search frontend source first. Use `rg` for the exact text, then distinctive substrings, punctuation-normalized variants, and nearby label text when the exact search fails. Record the searched terms, whether they matched, and matching file/line references.
3. If the text appears in raw JSX text, UI prop strings, local menu definitions, button labels, form labels, table column titles, empty states, validation messages, local enum maps, or other user-facing source strings, classify it as a frontend application issue. This is `i18n-related` and may receive a normal `I18N-xxx` ID.
4. If the text appears in `.d(defaultMessage)` or the default locale pack, but the target locale shows fallback or a missing key, classify it as a frontend locale/fallback issue. This is `i18n-related` and may receive a normal `I18N-xxx` ID.
5. Treat command and navigation labels as frontend-leaning by default. Buttons, menus, tabs, navigation items, toolbar actions, dropdown action labels, and form submit/cancel labels are usually frontend-owned product copy. Only classify these as backend/API-owned when there is concrete evidence that the UI renders server-provided menu configuration, API action configuration, remote module metadata, or platform-delivered configuration.
6. If source search does not find the text, inspect runtime origin. Check whether the text appears only after data loading, and inspect network/API responses when browser tooling exposes them safely. Record endpoint/path, status, relevant field names, and a short response-shape summary. Do not copy sensitive payloads.
7. Distinguish user-created data from system product copy. File names, project names, resource names, uploaded asset names, imported record values, custom tags, comments, notes, titles, descriptions, and values that map to create/edit form fields are usually user-created data and should normally be `non-i18n`. System action labels, validation messages, error messages, empty states, product-defined enum labels, backend templates, hints, warnings, policy text, table headers, and filter labels are usually product copy.
8. If API data is likely user-created data, classify it as `non-i18n` and record the out-of-scope reason. If API data is likely system product copy, classify it as a likely backend/API localization issue. If evidence is insufficient, set status to `needs-product-confirmation`, set recommended owner to `backend/API` or `unknown`, set fix verification to `low`, and require human attention.

Normal `I18N-xxx` findings for unexpected-language text must include direct localization evidence: frontend source/fallback evidence, or clear evidence that system product copy is being rendered in the wrong language. User-created data and uncertain ownership should stay out of the normal i18n finding list.

Unexpected-language triage answers only "who likely owns this text." It must not end the inspection. Even when all unexpected-language text is classified as user-created data or out of scope, continue the UI-fit pass for truncation, wrapping, table behavior, forms, dialogs, popovers, grouped controls, and layout integrity.

### Observation Evidence Contract

`non-i18n`, `i18n-blocking`, and `needs-product-confirmation` observations are not normal localization findings, but they still require evidence when they are included in the final report.

For each such observation, record:

- a separate ID such as `BLOCKER-001`, `NON-I18N-001`, or `CONFIRM-001`;
- URL or state, target locale, viewport, action sequence, and observed text or behavior;
- at least one screenshot reference when the UI was reachable, with red-box annotations when the region is not obvious;
- source-search evidence when the observation involves visible text in an unexpected language;
- runtime/API/data-field evidence when browser tooling exposes it safely;
- user-created-data assessment when relevant;
- out-of-scope reason or human follow-up action;
- recommended owner or next investigation path.

The final `report.html` must render these as evidence cards with inline screenshots, not only as prose notes. Render `i18n-blocking` items under a separate `Blockers` report topic. Render `non-i18n` and `needs-product-confirmation` items under a separate `Non-i18n observations` report topic. Keep both topics visually separate from normal `I18N-xxx` findings and do not count them as fixed i18n issues.

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

For unexpected-language findings, include the source-origin rationale explicitly. Button, menu, tab, navigation, toolbar action, dropdown action, and form command labels should remain frontend-owned unless source search plus runtime evidence proves they are server-provided or remote-module metadata. API values that look like user-created names or custom fields should not be assigned to localization owners without evidence that the product expects those values to be localized.

### Fix Recommendation

Every finding must include a fix recommendation. If the issue appears fixable in the current repository, choose the smallest change that preserves both language quality and UI quality.

For UI layout issues such as truncation, overflow, overlap, misalignment, or component visual integrity:

1. Prefer improving the target-locale wording first when the translation is unnecessarily long, literal, or awkward.
2. If shorter natural wording would lose important meaning, prefer a small local layout or width adjustment when it solves the issue. This can be low risk when it is component-scoped and does not alter shared layout behavior or unaffected locales.
3. Keep layout changes as small and local as possible. Do not use a broad layout rewrite when a natural target-locale wording change, local width adjustment, or narrower component-level fix would solve the issue.
4. If a broad layout change is truly required, first identify the language or locale where the issue occurs and scope the broad change to that problem language instead of changing unaffected languages.
5. Mark the fix risk as high when the fix changes shared layout behavior, page-level structure, table column allocation, responsive grid rules, locked/fixed columns, default-locale visual layout, or introduces a locale-scoped broad layout branch, even if the target-locale screenshot looks fixed.
6. Prefer general small fixes that work across locales. Use language-specific styles or locale branches only when needed to avoid breaking unaffected languages or the default-locale layout.

For CSS width, flex, overflow, or scroll-container fixes, inspect the DOM hierarchy and existing parent/child width rules before editing. Do not apply the same reserved-space calculation to both a parent wrapper and its child scroll container, such as setting `width: calc(100% - rightToolbarWidth)` on both levels. A valid fix must preserve or improve visible content capacity at the same viewport. If the after screenshot shows a smaller visible range, fewer visible tabs/columns/actions, or a newly hidden adjacent control, roll the fix back and re-triage the observation instead of reporting it as fixed.

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
5. For horizontally scrollable tab strips or grouped controls, compare before/after visible item capacity. A change that reduces the visible tab range, hides more actions, or makes scroll controls consume more content space is a regression even if the scroll buttons still work.

For translation quality issues:

1. Translate by product meaning, not word-by-word.
2. Use visible UI context, nearby source code, route/module context, validation logic, and adjacent labels to infer the intended user action and business meaning.
3. If the user provides supporting material such as a glossary, terminology guide, product documentation, or design copy, follow it when it improves accuracy.
4. In the recommendation, mention the evidence used for the wording choice, such as a provided glossary, industry/common terminology, or current repository business context.

For issues that do not appear fixable in the current repository, recommend the next owner or investigation path instead of proposing a local code change. Examples include backend/API payload changes, shared component package fixes, module federation remote fixes, or third-party widget limitations.

### Fix Scope Handling

When the user asks for fixing or the task scope otherwise includes remediation, do not stop at reporting current-repository issues that are low risk and directly verifiable. Prefer the smallest local change when all of these are true:

- the finding is `i18n-related`;
- recommended owner is `current repository`;
- fix risk is `low`, or a locally contained `medium` risk that can be verified in the affected page state;
- the fix does not require destructive actions, final submissions, permission changes, backend/API contract changes, publishing, deletion, or external system mutation;
- the exact affected UI state can be re-inspected with before/after screenshots.

For each attempted fix, update `inspection-log.md` with the changed file paths, concise relevant diff, validation command, before screenshot, after screenshot, and retest result. A finding should become `verifiedFixed` only after browser re-inspection shows the visible issue is gone.

When fixing is out of scope, blocked, too risky, owned outside the current repository, or unverifiable, leave the finding open and write the reason, recommended change, acceptance criteria, and human follow-up. Do not show empty diff blocks in `report.html`.

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

Every screenshot should have a short caption and capture timestamp in `inspection-log.md` while inspecting. Use exact timestamps with timezone when available. When the final report is generated, include the same caption context and capture time in `report.html`:

- what page or state it shows;
- what action produced it;
- whether it is normal coverage evidence or issue evidence;
- when the screenshot was captured.

After every screenshot capture, verify the screenshot file exists and has a plausible non-zero size before using it as evidence. If the browser tool returns screenshot bytes, prefer explicitly writing those bytes and then checking the file. Record screenshot-write failures in `inspection-log.md`; do not mark a route as covered with a missing or zero-byte screenshot.

For broad route, menu, or full-product inspections, maintain a screenshot manifest in `inspection-log.md` as a table or compact list. Each row should map one coverage item to its screenshot evidence:

- scope label, such as a menu item, tab, route, or detail state;
- URL/route or page state;
- action taken;
- screenshot path;
- captured time;
- status: `covered`, `blocked`, `skipped-risky`, `external-out-of-scope`, or `not-reached`;
- short note.

The final `report.html` must reproduce this coverage evidence in the screenshot appendix rather than in a separate coverage matrix. Follow the wireframe's Screenshot appendix information structure for every screenshot, including coverage metadata when available. Do not only show issue screenshots or a few "important" screenshots when the user asked for a broad inspection; the reader must be able to audit which pages were actually opened from the screenshot appendix.

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
- current source risk scan summary, searched patterns, key matches, and browser states targeted by those matches when a repository is available;
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

Write blockers, non-i18n observations, and product-confirmation items into their dedicated top-level report arrays when present. Do not bury them in prose or mix them into the normal `findings` array unless a legacy consumer requires compatibility. Each observation needs screenshot evidence when reachable and source/runtime evidence when it involves visible unexpected-language text.

When independent visual review is used, write review evidence to `visualReviewReports` in `report.json`. Each entry should point to the Markdown report in `visual-reviews/`, list the screenshots reviewed, and state how reviewer observations were triaged. If the pass was skipped or unavailable for a broad inspection, state that limitation in `inspection-log.md` and `report.html` instead of pretending screenshot coverage equals independent review coverage.

When a finding is about component visual integrity, set `category` to `component visual integrity` and include a concise subtype when useful, such as `grouped-control wrapping/broken border`. If a legacy consumer cannot handle that category, mirror the subtype in the finding title or human-readable notes while keeping the visible issue clear in `report.html`.

For every finding, write both `fixVerification` and `fixRisk`. `fixVerification` is about whether the fix or recommendation solves the visible issue; `fixRisk` is about possible side effects. Older reports may contain a deprecated `fixConfidence` field with the same meaning; new reports should use `fixVerification`. When local source, style, config, or locale files were changed for a finding, write concise relevant non-empty hunks to `fixEvidence.codeDiffs`. Omit `fixEvidence.codeDiffs` when no local source/style/config/locale file changed or when there is no meaningful diff hunk. Do not dump unrelated diffs into the report.

### `report.html`

`report.html` is the human-readable final report. When [UI Inspection Report Wireframe](ui-inspection-report-wireframe.html) is available, generate the final report by copying that file to the inspection artifact folder as `report.html`, then editing the copied file in place. Do not hand-roll a separate report layout from prose.

The wireframe must contain report-like sample content only. Keep template usage instructions, replacement contracts, and generation rules in this skill document and checklist, not as visible sections inside the wireframe HTML.

Treat the copied wireframe as the source file for the final report, not as visual inspiration and not as a starter file to overwrite. After copying it, keep its information architecture, CSS, section wrappers, major class names, modal/lightbox JavaScript, feedback-copy JavaScript, navigation topics, and screenshot annotation structure. The report-writing task is a copy-edit/data-replacement task inside the copied file.

Do not generate a new complete HTML document string and write it over the copied `report.html`. Do not replace the wireframe with a smaller custom Bootstrap page, a simplified report card layout, or a bespoke generated layout. If using a script to help with report generation, the script must transform the copied wireframe in place or fill designated repeated blocks while preserving the wireframe skeleton.

Allowed copy-edit operations:

- replace visible sample text, metadata, counts, table rows, captions, screenshot paths, finding IDs, code diffs, and observation content with real run data;
- duplicate an existing wireframe finding card or observation card to represent additional real findings or observations, preserving its class names and internal structure;
- remove extra sample finding cards only after all real findings have been rendered through the same wireframe card structure;
- replace `mock-shot` placeholder content with real `<img>` evidence while keeping the `annotated-shot`, `annotated-stage`, and `redbox` overlay structure;
- localize visible report text to the chosen report language without changing section identity or interaction behavior.

Forbidden report-generation operations:

- deleting required top-level topics such as `Blockers`, `Non-i18n observations`, or `Screenshot appendix` because the run has little or no data for them;
- replacing `annotated-shot` / `annotated-stage` evidence blocks with generic image cards;
- omitting red-box annotations for finding evidence when the issue region is not visually obvious;
- replacing wireframe finding cards with simplified before/after cards;
- moving skill/tooling notes into a new top-level report section when they belong in `inspection-log.md` or concise report notes;
- replacing the wireframe's modal, lightbox, feedback-copy, or back-to-top script with unrelated custom behavior.

After copying the wireframe, replace every sample value, mock screenshot, placeholder finding, source path, diff, and observation with real inspection evidence from `inspection-log.md`, `report.json`, and the screenshot folder. Remove `data-template-sample="true"` and any remaining template-only markers from the final report after replacement.

The report wireframe is a desktop-only, latest-Chrome template. Do not spend report-generation effort on mobile or legacy-browser fallbacks unless the user explicitly asks for them. The wireframe uses the complete Bootstrap 4.5.3 CSS file from `https://g.alicdn.com/code/lib/bootstrap/4.5.3/css/bootstrap.min.css`. Do not also include `bootstrap-grid.min.css`, because the complete CSS already includes the grid and component styles. Reuse Bootstrap component and utility classes for standard UI pieces such as badges, tables, buttons, form controls, cards, alerts, and muted text. Keep custom CSS for report-specific structure, screenshot annotation overlays, modal/lightbox layout, and evidence presentation. Do not include Bootstrap 4 JavaScript from the CDN unless the report also supplies the required jQuery dependency; the wireframe's modal, lightbox, feedback-copy, and back-to-top behavior should remain implemented with native JavaScript.

Preserve the wireframe's required section order, CSS class structure, modal/lightbox behavior, feedback-copy behavior, blockers topic, non-i18n topic, and screenshot appendix. Empty sections should be marked with a real inspection limitation or a no-data statement, not deleted and not left with sample rows.

Choose the `report.html` display language before writing the file:

- use the language of the user's inspection request by default;
- use a user-specified report language when provided;
- use English as the fallback default when the request language is unclear;
- do not infer the report language from the inspected UI target locale;
- localize report headings, dashboard labels, prose, finding explanations, table headers, screenshot captions, status labels, blocker text, and lightbox controls;
- keep product names, locale codes, URLs, file paths, commands, finding IDs, key names, and code identifiers unchanged when translating them would reduce precision.

The wireframe defines the expected report information architecture and default interactions. Keep detailed visual, layout, and interaction choices in the wireframe. This document only defines the durable report contracts below:

- Include the requested scope, locale, viewports, browser/tool, coverage status, visual-review status, blockers, skipped areas, and every accepted finding from `inspection-log.md` and `report.json`.
- Keep `Blockers` and `Non-i18n observations` as separate report topics, and keep both visually separate from normal i18n/UI-fit findings.
- Render blockers, non-i18n observations, and needs-product-confirmation items as evidence cards with inline screenshots, source search/runtime evidence, ownership rationale, and human follow-up or out-of-scope reason. Place needs-product-confirmation cards under `Non-i18n observations` unless the user asks for a separate product-confirmation topic.
- Do not include a separate "Inspection timeline" section in `report.html`; keep chronological details in `inspection-log.md` and use screenshot capture times in the screenshot appendix for reader context.
- Do not include standalone "Human attention and risk", "Report interaction validation", or "Independent visual review appendix" sections in `report.html`; keep report-interaction verification details and independent visual-review triage details in `inspection-log.md`, and keep human-attention/risk details inside the relevant finding or observation cards.
- Distinguish text overflow/truncation, layout overflow, alignment, and component visual integrity. Do not summarize the result as only "No visible overflow found".
- Use screenshot annotation data from `report.json` and preserve coordinate alignment in cards, modals, appendices, and enlarged previews.
- In the screenshot appendix, render every screenshot with filename, caption/context, and capture time under the thumbnail. Prefer the exact timestamp recorded when the screenshot was captured, including timezone when available. When the screenshot is tied to coverage evidence, render scope, URL/state, action, status, and notes in the same appendix item.
- Show concise code diffs only for findings with local source, style, config, or locale changes. Omit empty diff blocks.
- Keep the feedback-copy behavior: copy only findings whose feedback textarea is not empty after trimming whitespace. Use one blank line between findings, formatted as:

```text
Finding I18N-010: This should be fixed by increasing the column width.

Finding I18N-012: Please fix. Prefer increasing the label column width.
```

- If every feedback textarea is empty, show a localized "no feedback to copy" status instead of copying blank findings.
- If clipboard access is unavailable, show a visible fallback textarea containing only the generated non-empty feedback payload so the user can copy manually. This is preferable to reporting a generic copy failure.
- Ensure local `file://` report interactions work without new npm packages or external JavaScript. Bootstrap CSS may load from the approved Alibaba CDN above; all report interactions must still work if only the inline native JavaScript runs.
- Preserve modal stack behavior from the wireframe. If a finding-detail modal is open and the user opens an image preview/lightbox from inside it, pressing `Escape` must close only the topmost image preview. A second `Escape` may then close the underlying finding-detail modal.
- Implement `Escape` handling on the real latest-Chrome keyboard event path with a capture-phase `keydown` listener and `event.key === "Escape"`. Ignore `event.repeat` so a long key press does not close both a lightbox and its parent modal. Make modal and lightbox containers focusable and move focus into the active modal when it opens, so manual keyboard use and browser-driven key events both work.

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

This smoke test is a final-report gate, not an optional diagnostic:

- Do not hand off `report.html` if this command fails.
- Do not replace this with string-presence checks such as checking whether `copyFeedback`, `modalStack`, or `addEventListener` appears in the HTML; those checks do not prove the script parses.
- Save the exact successful output, such as `checked 1 executable script(s)`, in `inspection-log.md` so the run has durable evidence that executable report JavaScript was actually parsed.
- If browser policy or environment restrictions prevent opening `report.html`, this syntax smoke test is still required. State the browser limitation separately instead of treating it as a reason to skip the script parse check.

Before handoff, verify the final `report.html` no longer contains the wireframe-only template marker `data-template-sample="true"`, any visible template usage instructions such as a "Template replacement contract" section, or unreplaced sample identifiers such as `ExampleToolbar.tsx`, `mock-shot`, or the wireframe reference paragraph. If any remain, the report has not been generated from real inspection data yet.

The final report must not make the user open the screenshots folder just to know whether the requested scope was covered. If every screenshot is saved on disk but the HTML report omits the complete screenshot appendix or omits coverage metadata from appendix items, the report is incomplete.

If no issues are found, still generate `report.html`, include process screenshots for all covered scope items, and state what was actually verified. Do not write only "No visible overflow found" as the final result. Distinguish at least text overflow/truncation, layout overflow, alignment, and component visual integrity. If the run only checked overflow metrics or screenshots for obvious truncation, state that component visual integrity was not fully verified.

If independent visual review was used and no issues were accepted, state that visual-review observations were triaged and no findings remained. If reviewer observations were dismissed, include the dismissal rationale in `inspection-log.md`; do not create a separate visual-review appendix in `report.html`.

Before handing off, open the generated `report.html` when possible and verify representative wireframe interactions. Also verify there are no JavaScript syntax errors, red-box annotations are visually aligned in at least one normal and enlarged report view, nested modal `Escape` behavior closes only the topmost modal, empty code-diff blocks are omitted, and any scroll-to-top behavior changes the actual scroll container rather than only calling `window.scrollTo`.

Do not validate `Escape` behavior only by calling `document.dispatchEvent(new KeyboardEvent(...))` from page JavaScript. That can produce false positives. Use a manual key press or browser automation that sends a real key event, such as Chrome DevTools `Input.dispatchKeyEvent`, Playwright `page.keyboard.press("Escape")`, or an equivalent browser-level keyboard action.

The representative browser interaction check must cover at least:

1. Click a finding title in the overview and confirm the finding detail modal opens.
2. From inside the finding modal, click a screenshot and confirm the lightbox opens.
3. Press `Escape` once and confirm only the lightbox closes while the finding modal remains open.
4. Press `Escape` again and confirm the finding modal closes.
5. Click a screenshot from the screenshot appendix or an observation evidence card and confirm the lightbox opens.
6. Click "copy findings and feedback" with all feedback fields empty and confirm the localized empty-feedback status appears.
7. Add feedback to one finding, copy again, and confirm only non-empty feedback is copied or reported as copied.
8. Scroll down until the right-side Back to top button appears, click it, and confirm the actual scroll container returns to the top and any hash-only position is cleared.
9. Verify modal close buttons and backdrop clicks close the active modal without breaking the `Escape` topmost-modal behavior.

If opening `report.html` through `file://` is blocked by browser policy, serve the inspection folder through a local static HTTP server and repeat the interaction check there. Do not hand off the report as fully verified when only the inline-script syntax smoke test has run.

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
- unexpected-language origin evidence when relevant: observed text, expected locale, detected unexpected language, source search terms/results, runtime origin evidence, user-created-data assessment, and ownership rationale;
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
