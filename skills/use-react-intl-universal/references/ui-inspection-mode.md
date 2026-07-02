# UI Inspection Mode

Open this reference when the user asks to inspect, patrol, audit, or QA a running localized UI by page URL.
This mode is for browser-facing localization quality checks, not for normal source-code editing.

## Purpose

Use browser interaction to discover localized UI issues that static source or locale checks cannot prove, especially:

- text truncation;
- text overflow;
- overlapping text or controls;
- visual misalignment caused by translated copy length;
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
5. Open the user-provided page URL and capture an initial full-page or viewport screenshot.
6. Record the environment in the report: URL, locale, browser/tool, viewport size, account/role if known, and inspection time.
7. Enumerate visible interactive elements:
   - navigation links;
   - tabs;
   - buttons;
   - dropdowns and selects;
   - filters and search inputs;
   - table row actions;
   - pagination;
   - tooltips and hover states;
   - forms and validation states;
   - modals, drawers, popovers, notifications, and confirmation dialogs.
8. Interact with each safe element or representative group of repeated elements.
9. After each meaningful state change, capture a screenshot and record what was clicked or typed.
10. Handle popups and dialogs by checking their localized text, layout, primary/secondary buttons, close/cancel behavior, and validation messages.
11. If an interaction opens another route, inspect that route if it remains within the user's requested scope.
12. Keep going until the reachable page area has been covered, a blocker is reached, or the user-provided time/scope limit is exhausted.

For repeated controls, sample enough instances to cover different text lengths and states. Do not spend time clicking identical repeated buttons that render the same UI unless their row data changes the text or layout risk.

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
7. Write acceptance criteria that can prove the fix worked.

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
- untranslated text;
- raw placeholder/tag;
- terminology inconsistency;
- interaction defect.

### Translation Quality Category

This field is optional. Fill it only when the primary issue is about wording quality, such as `language quality` or `terminology inconsistency`. Write `N/A` or omit it for pure layout issues such as truncation, overflow, overlap, or misalignment.

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

For UI layout issues such as truncation, overflow, overlap, or misalignment:

1. Prefer improving the target-locale wording first when the translation is unnecessarily long, literal, or awkward.
2. If shorter natural wording would lose important meaning, adjust the UI style or layout.
3. Prefer general layout fixes that work across locales. Avoid language-specific CSS when a robust shared layout fix is reasonable.
4. Use language-specific styles only when a general fix is too costly, would make the default locale look worse, or would create broader layout risk.

For translation quality issues:

1. Translate by product meaning, not word-by-word.
2. Use visible UI context, nearby source code, route/module context, validation logic, and adjacent labels to infer the intended user action and business meaning.
3. If the user provides supporting material such as a glossary, terminology guide, product documentation, or design copy, follow it when it improves accuracy.
4. In the recommendation, mention the evidence used for the wording choice, such as a provided glossary, industry/common terminology, or current repository business context.

For issues that do not appear fixable in the current repository, recommend the next owner or investigation path instead of proposing a local code change. Examples include backend/API payload changes, shared component package fixes, module federation remote fixes, or third-party widget limitations.

### Acceptance Criteria

Write observable retest steps for every finding. Include the same URL, locale, viewport, user action, and expected visual or language result. When the issue had screenshot evidence, the acceptance criteria should ask for a replacement screenshot after the fix.

## Screenshot Requirements

The report must include all screenshots captured during the inspection.
Use stable, numbered filenames such as:

```text
screenshots/001-initial-page.png
screenshots/002-open-language-menu.png
screenshots/003-dialog-validation.png
screenshots/004-issue-overflow-filter-label.png
```

Every screenshot should have a short caption in the report explaining:

- what page or state it shows;
- what action produced it;
- whether it is normal coverage evidence or issue evidence.

When an issue is found, capture the smallest screenshot that clearly shows the problem. If context matters, also include a wider screenshot.

## Report Structure

Write the report to the inspection folder. Prefer a folder under the repository's ignored temporary-output location found from `.gitignore`.
For example:

```text
tmp/i18n-ui-inspection-YYYYMMDD-HHMMSS/report.md
```

The report must contain these sections.

### Summary

Include:

- inspected URL or routes;
- target locale;
- browser/tool and viewport;
- account/role if relevant;
- total interactions covered;
- total screenshots;
- number of issues by severity;
- blockers or untested areas.

### Part 1: Inspection Process

List the full inspection path in chronological order.
Each row or bullet should include:

- step number;
- action taken;
- observed state;
- screenshot link;
- notes or coverage limitation if any.

Example:

```md
| Step | Action | Observed State | Screenshot |
| --- | --- | --- | --- |
| 1 | Opened `/settings?locale=de-DE` | Page loaded in German. Header, sidebar, and form were visible. | [001](screenshots/001-initial-page.png) |
| 2 | Opened the status dropdown | Options were translated and no overflow was visible. | [002](screenshots/002-status-dropdown.png) |
```

### Part 2: Findings

For each issue, include:

- ID, severity, and title;
- affected URL/state;
- target locale and viewport;
- reproduction steps;
- expected result;
- actual result;
- screenshot link;
- likely category: language quality, truncation, overflow, overlap, misalignment, untranslated text, raw placeholder/tag, terminology inconsistency, or interaction defect;
- translation quality category: Accuracy, Fluency, Terminology, Locale convention, or N/A for pure layout issues;
- likely root cause: frontend application issue, backend/API issue, external dependency issue, or unknown/needs investigation;
- root-cause evidence: one or two concise observations supporting the classification;
- recommended owner: current repository, backend/API, shared component package, module federation remote, third-party vendor, or unknown;
- fix recommendation: the concrete change to try first, or the owner/investigation path if it is not fixable in the current repository;
- fix priority/rationale: why this recommendation comes before other options, such as shortening a translation before changing CSS.
- acceptance criteria: the exact retest steps or observable conditions that confirm the issue is fixed.

Example:

```md
#### I18N-001 [High] Filter button text overlaps the icon

- URL/state: `/orders`, advanced filter drawer open
- Locale/viewport: German, 1280x800
- Steps: Open page, click "Advanced filters", select "Delivery status".
- Expected: Button label and icon remain separated.
- Actual: The translated label overlaps the chevron icon.
- Screenshot: [004](screenshots/004-filter-overlap.png)
- Category: overlap, compact UI length
- Translation quality category: N/A
- Likely root cause: frontend application issue
- Root-cause evidence: The API returned the expected translated label, and the overlap happens inside the page's local filter button layout after the text is rendered.
- Recommended owner: current repository
- Fix recommendation: First review whether the German label can be shortened naturally without losing meaning. If not, allow the button label to wrap or increase the button min-width with a shared responsive rule.
- Fix priority/rationale: Text refinement is lower risk for compact UI when the wording is unnecessarily long; use a general layout fix next because this button may receive long labels in multiple locales.
- Acceptance criteria: Reopen `/orders` at 1280x800 in German, open the advanced filter drawer, select "Delivery status", and confirm the button label and chevron no longer overlap. Capture a replacement screenshot.
```

If no issues are found, still provide the process screenshots and state that no visible localized UI issues were found in the covered scope.

## Final Handoff

When reporting back to the user, include:

- the report path;
- the screenshot folder path;
- a short issue summary;
- any blockers or untested risky actions.

Do not paste every screenshot into the chat unless the user asks. The durable report should be the complete source of evidence.
