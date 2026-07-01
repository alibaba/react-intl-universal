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

## Root-Cause Classification

When a finding is recorded, include a likely root-cause field. Classify the issue as one of:

- frontend application issue: local page code, CSS/layout, component usage, routing, i18n usage, locale wiring, or message composition likely caused the problem;
- backend/API issue: an API response, server-rendered data, missing localized field, malformed placeholder value, permission state, or test data likely caused the problem;
- external dependency issue: a shared frontend component package, module federation remote, design-system package, third-party SDK, browser extension, or hosted asset likely caused the problem;
- unknown or needs investigation: the browser evidence is not enough to assign ownership safely.

Do not overclaim ownership. Use "likely" language unless the browser evidence clearly proves the cause. Add a short rationale with the evidence used, such as:

- console error or stack trace;
- network request URL, status, and relevant response shape;
- visible component/module boundary if known;
- whether the issue reproduces before or after data loads;
- whether the same text renders correctly in another page state;
- whether the defect appears inside a shared component, remote module, or third-party widget.

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
- likely root cause: frontend application issue, backend/API issue, external dependency issue, or unknown/needs investigation;
- root-cause evidence: one or two concise observations supporting the classification;
- suggested next step.

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
- Likely root cause: frontend application issue
- Root-cause evidence: The API returned the expected translated label, and the overlap happens inside the page's local filter button layout after the text is rendered.
- Suggested next step: Allow the button to wrap or increase the min-width for localized labels.
```

If no issues are found, still provide the process screenshots and state that no visible localized UI issues were found in the covered scope.

## Final Handoff

When reporting back to the user, include:

- the report path;
- the screenshot folder path;
- a short issue summary;
- any blockers or untested risky actions.

Do not paste every screenshot into the chat unless the user asks. The durable report should be the complete source of evidence.
