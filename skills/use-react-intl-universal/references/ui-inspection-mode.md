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
- the expected account, role, tenant, workspace, or test data if the app requires login;
- viewport requirements if the user provides them.

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
14. When a finding is discovered, append the full finding detail, likely root cause, fix recommendation, and acceptance criteria to `inspection-log.md`.
15. If the task includes fixing issues, append each attempted fix and re-inspection result to `inspection-log.md`, including before/after screenshot paths.
16. Handle popups and dialogs by checking their localized text, layout, primary/secondary buttons, close/cancel behavior, and validation messages.
17. If an interaction opens another route, inspect that route if it remains within the user's requested scope.
18. Keep going until the reachable page area has been covered, a blocker is reached, or the user-provided time/scope limit is exhausted.

For repeated controls, sample enough instances to cover different text lengths and states. Do not spend time clicking identical repeated buttons that render the same UI unless their row data changes the text or layout risk.

Do not rely only on DOM overflow metrics such as `scrollWidth > clientWidth`, bounding boxes, or obvious text truncation. These are useful signals, but they do not prove UI-fit. Also inspect screenshots for whether compact components still look like complete components.

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
- Compact UI such as placeholders, badges, sidebars, breadcrumbs, and table cells still works.
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

1. Assign severity based on user impact.
2. Choose the primary issue category from the visible symptom.
3. Add a translation quality category only when the problem is about wording quality.
4. Classify the likely root cause and record evidence.
5. Choose a recommended owner.
6. Write the fix recommendation and why that fix should be tried first.
7. Assign fix confidence: high, medium, or low.
8. Record whether human attention is needed, especially when the fix may have compatibility risk, shared-component side effects, route-family impact, locale-specific risk, or product-copy uncertainty.
9. Write acceptance criteria that can prove the fix worked.

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
- untranslated text;
- raw placeholder/tag;
- terminology inconsistency;
- interaction defect.

Use `component visual integrity` when a control is technically readable and not overflowing, but no longer looks or behaves as one coherent component. Common subtypes include grouped-control wrapping, broken joined borders, incorrect first/last-item radius after wrapping, detached active states, and icon/text/arrow separation. If a reporting system cannot accept a new category, use `misalignment` and set the subtype or finding title to `grouped-control wrapping/broken border`.

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
2. If shorter natural wording would lose important meaning, adjust the UI style or layout.
3. Prefer general layout fixes that work across locales. Avoid language-specific CSS when a robust shared layout fix is reasonable.
4. Use language-specific styles only when a general fix is too costly, would make the default locale look worse, or would create broader layout risk.

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

For broad route, menu, or full-product inspections, maintain a screenshot manifest in `inspection-log.md` as a table or compact list. Each row should map one coverage item to its screenshot evidence:

- scope label, such as a menu item, tab, route, or detail state;
- URL/route or page state;
- action taken;
- screenshot path;
- status: `covered`, `blocked`, `skipped-risky`, `external-out-of-scope`, or `not-reached`;
- short note.

The final `report.html` must reproduce this coverage evidence. Do not only show issue screenshots or a few "important" screenshots when the user asked for a broad inspection; the reader must be able to audit which pages were actually opened.

When an issue is found, capture the smallest screenshot that clearly shows the problem. If context matters, also include a wider screenshot.

## Inspection Artifacts

Write all inspection artifacts to the inspection folder. Prefer a folder under the repository's ignored temporary-output location found from `.gitignore`.
The final folder shape is:

```text
tmp/i18n-ui-inspection-YYYYMMDD-HHMMSS/inspection-log.md
tmp/i18n-ui-inspection-YYYYMMDD-HHMMSS/screenshots/
tmp/i18n-ui-inspection-YYYYMMDD-HHMMSS/report.json
tmp/i18n-ui-inspection-YYYYMMDD-HHMMSS/report.html
```

At the start and during the middle of inspection, only the first two entries should exist.

During active inspection, create and maintain only these artifacts:

- `inspection-log.md`: raw chronological task log. Update this while inspecting, fixing, and re-inspecting.
- `screenshots/`: all screenshots captured during inspection, fixing, and re-inspection.

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
- finding details as soon as an issue is discovered;
- root-cause reasoning and evidence;
- fix recommendation, fix confidence, human-attention reason, and acceptance criteria;
- fix attempts, code or configuration areas touched when known, re-inspection result, and after-fix screenshots when fixing is in scope.

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

When a finding is about component visual integrity, set `category` to `component visual integrity` and include a concise subtype when useful, such as `grouped-control wrapping/broken border`. If a legacy consumer cannot handle that category, mirror the subtype in the finding title or human-readable notes while keeping the visible issue clear in `report.html`.

### `report.html`

`report.html` is the human-readable final report. It should be easier to read than raw Markdown and should make screenshot evidence visible without forcing the reader to open many files.

Include these sections:

1. Summary dashboard:
   - inspected URL/routes, locales, viewports, browser/tool, and account/role if relevant;
   - total interactions and screenshots;
   - issue totals by severity, status, and fix confidence;
   - coverage status for text overflow/truncation, layout overflow, alignment, and component visual integrity;
   - human-attention items, with medium confidence shown in yellow and low confidence shown in red;
   - blockers and untested areas.
2. Findings:
   - one card or section per finding;
   - severity, status, fix confidence, category, translation quality category, likely root cause, recommended owner, and affected state;
   - render fix confidence as a colored badge: high = green, medium = yellow, low = red;
   - reproduction steps, expected result, actual result, fix recommendation, fix priority/rationale, human-attention note, and acceptance criteria;
   - before/after screenshot comparison when fix evidence exists. Use a two-column layout where the left column shows the issue screenshot and the right column shows the verified-fix screenshot.
3. Coverage evidence matrix:
   - one row per requested route, menu item, tab, feature entry, or representative detail state;
   - label, URL/route/state, action taken, status, screenshot thumbnail or link, and notes;
   - blocked, skipped risky, external, and not-reached items must be visible in the same matrix, not hidden in prose;
   - for full left-navigation or full-product inspections, this matrix is mandatory and is the primary proof that the agent actually visited the requested areas.
4. Inspection timeline:
   - concise chronological table derived from `inspection-log.md`;
   - action, observed state, notes, and screenshot link.
5. Screenshot appendix:
   - all screenshot captions and paths, including normal coverage screenshots, detail-state screenshots, issue screenshots, and fix/re-inspection screenshots;
   - render screenshots as clickable thumbnails or a gallery when the count is manageable;
   - if the report uses collapsed sections for many screenshots, the default visible text must still list every screenshot filename and caption.
6. Appendix:
   - blockers, skipped risky actions, and untested areas;
   - external dependency or backend/API ownership notes when relevant.

The final report must not make the user open the screenshots folder just to know whether the requested scope was covered. If every screenshot is saved on disk but the HTML report omits the complete coverage matrix or screenshot appendix, the report is incomplete.

If no issues are found, still generate `report.html`, include process screenshots for all covered scope items, and state what was actually verified. Do not write only "No visible overflow found" as the final result. Distinguish at least text overflow/truncation, layout overflow, alignment, and component visual integrity. If the run only checked overflow metrics or screenshots for obvious truncation, state that component visual integrity was not fully verified.

## Finding Details

For each issue, include:

- ID, severity, and title;
- affected URL/state;
- target locale and viewport;
- reproduction steps;
- expected result;
- actual result;
- screenshot link;
- likely category: language quality, truncation, overflow, overlap, misalignment, component visual integrity, untranslated text, raw placeholder/tag, terminology inconsistency, or interaction defect;
- component visual integrity subtype when relevant, such as `grouped-control wrapping/broken border`;
- translation quality category: Accuracy, Fluency, Terminology, Locale convention, or N/A for pure layout issues;
- likely root cause: frontend application issue, backend/API issue, external dependency issue, or unknown/needs investigation;
- root-cause evidence: one or two concise observations supporting the classification;
- recommended owner: current repository, backend/API, shared component package, module federation remote, third-party vendor, or unknown;
- fix recommendation: the concrete change to try first, or the owner/investigation path if it is not fixable in the current repository;
- fix priority/rationale: why this recommendation comes before other options, such as shortening a translation before changing CSS.
- fix confidence: high, medium, or low;
- human attention: whether human review is needed, why, and any side-effect or compatibility risk;
- acceptance criteria: the exact retest steps or observable conditions that confirm the issue is fixed.

Use these lifecycle statuses for the matching `report.json` finding:

- `open`: the issue is still present and has not been fixed.
- `fixed`: a fix was made, but the exact UI state has not been re-inspected yet.
- `verifiedFixed`: the fix was re-inspected and confirmed with replacement screenshot evidence.
- `deferred`: the issue is real, but the team postponed it.
- `wontFix`: the issue is real, but the team does not plan to fix it.

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
- Fix confidence: medium
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
- Fix confidence: medium
- Human attention: Review neighboring toolbar breakpoints because the fix may affect compact filter layouts.
- Acceptance criteria: Reopen the same URL/locale/viewport and confirm the segmented control is either one coherent horizontal group or a deliberate vertical/grouped layout, with no broken borders or detached active states. Capture a replacement screenshot.
```

## Final Handoff

When reporting back to the user, include:

- the `inspection-log.md` path;
- the `report.json` path;
- the `report.html` path;
- the screenshot folder path;
- a short issue summary;
- any blockers or untested risky actions.

Do not paste every screenshot into the chat unless the user asks. The durable artifacts should be the complete source of evidence.
