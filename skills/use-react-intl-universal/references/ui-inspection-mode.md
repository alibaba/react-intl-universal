# UI Inspection Mode

Use this mode when the user asks to inspect, patrol, audit, or QA a running localized UI. It is an end-to-end workflow for exploration, source attribution, fixing, release verification, and evidence-backed reporting.

## Contents

- [Non-negotiable invariants](#non-negotiable-invariants)
- [Required inputs](#required-inputs)
- [Phase 0: bootstrap the run](#phase-0-bootstrap-the-run)
- [Phase 1: build the risk and coverage inventory](#phase-1-build-the-risk-and-coverage-inventory)
- [Phase 2: inspect depth-first](#phase-2-inspect-depth-first)
- [Phase 3: admit or reject observations](#phase-3-admit-or-reject-observations)
- [Phase 4: select and implement fixes](#phase-4-select-and-implement-fixes)
- [Phase 5: release and verify](#phase-5-release-and-verify)
- [Phase 6: finish artifacts and hand off](#phase-6-finish-artifacts-and-hand-off)
- [Safety boundaries](#safety-boundaries)

## Non-negotiable invariants

1. **Depth-first coverage:** finish the safe child states of one route, menu item, or tab before moving to its sibling. Inspecting only the default active state is partial coverage.
2. **Observed findings only:** a source match, long translation, or reviewer suspicion is not a UI finding until the relevant runtime state visibly demonstrates the problem.
3. **Attribution before fixing:** distinguish current-repository frontend copy, API/system copy, user-created data, shared/external UI, and unknown ownership before choosing a fix.
4. **Evidence before status:** never assign `verifiedFixed` until the exact released commit is visible in the target environment and accepted after evidence exists.
5. **No capacity regression:** a fix must not hide a component, shrink the useful visible range, expose fewer useful items, remove an editor or control, or merely move clipping to a neighboring element.
6. **Report prevention, not reconstruction:** copy the supplied wireframe before inspection and populate that copy throughout the run. Do not recreate its structure, CSS, or interactions from memory.
7. **One run identity per task:** reuse the first run folder and report for every loop on the same repository in the same Codex task. A new Codex task gets a new run identity.

## Required inputs

Identify these before browser work:

- repository path when source attribution or fixing is expected;
- existing browser and tab the user wants controlled;
- entry URL and target locale;
- report display language, which may differ from the inspected locale;
- account, role, workspace, tenant, and test data when relevant;
- viewport constraints;
- release or preview workflow when local rendering cannot prove the fix;
- user-provided glossary, style guide, product documentation, and environment-specific exclusions.

Inspect only the requested locale and languages exposed by the current product environment. Locale files in source do not expand runtime scope by themselves.

## Phase 0: bootstrap the run

### 0.1 Choose the durable run folder

Prefer an ignored temporary directory already used by the repository. Create:

```text
<ignored-temp>/i18n-ui-inspection-<first-run-id>/
  inspection-log.md
  report.json
  report.html
  screenshots/
```

If the current task already created a run for this repository, reuse it. Do not create a second timestamp folder for another loop in the same task.

### 0.2 Copy the report wireframe before inspection

This is a hard start condition:

```text
COPY skills/use-react-intl-universal/references/ui-inspection-report-wireframe.html
TO   <run-folder>/report.html
```

Treat the copied file as an immutable structural base:

- preserve its Bootstrap dependency, section hierarchy, badges, finding modal, image lightbox, nested Escape behavior, feedback controls, and right-side Back to top button;
- replace sample values, findings, screenshots, metadata, and visible language in place;
- add or remove repeated finding and screenshot entries only inside the existing content regions;
- do not rewrite the page from scratch, substitute a simplified report, redesign its interaction model, or copy isolated fragments from memory;
- do not leave sample findings, mock screenshots, template instructions, or `data-template-sample="true"` in the final report.

Initialize it before exploration so each accepted observation can be written to the same report immediately. Keep `report.json` as the only report data model and regenerate the copied HTML with `render-ui-inspection-report.mjs`; do not separately hand-maintain counts, cards, screenshot lists, and annotations in HTML.

### 0.3 Start the inspection log

Record:

- run identity and report path;
- repository, branch, baseline commit, dirty-state notes, and target release branch;
- URL, locale, report language, viewport, browser/tab, account/role if known, and start time;
- glossary/context files actually read;
- environment-specific exclusions;
- source-risk searches and later coverage decisions.

## Phase 1: build the risk and coverage inventory

### 1.1 Scan the current source

Use `rg` to locate high-risk UI patterns in the current route family:

- narrow fixed widths and compact inline styles;
- form-label widths, required markers, and colon rendering;
- fixed or locked table columns and action groups;
- `ellipsis`, `overflow: hidden`, `white-space`, `word-break`, and line clamps;
- grouped controls with wrapping, joined borders, or positional radius rules;
- long labels, placeholders, table headers, menus, status labels, errors, empty states, and enum display names;
- hardcoded source-language strings and locale fallbacks.

Use this scan to target browser states. A source match is not yet a finding.

### 1.2 Build the coverage tree

Create a live inventory from the visible product UI:

- product primary and secondary navigation;
- sidebars, trees, accordions, and side tabs;
- page tabs and segmented controls;
- dashboard modules and feature entry points;
- filters, selects, search, date controls, and pagination;
- create, configure, edit, and detail entries that can be opened without submission;
- representative row actions, drawers, modals, popovers, tooltips, and empty/disabled/validation states.

Each inventory item has one status:

- `pending`
- `in-progress`
- `covered`
- `partial`
- `duplicate-sampled`
- `skipped-risky`
- `blocked`
- `not-reached`
- `external-out-of-scope`

Never silently omit an in-scope visible entry.

## Phase 2: inspect depth-first

### 2.1 Route traversal

For each first-level route or menu item:

1. mark it `in-progress`;
2. open its initial state and wait for the page-specific main-content signal;
3. record URL, action, locale, time, and an accepted coverage screenshot;
4. inventory its child controls;
5. inspect safe child controls recursively before returning to the parent inventory;
6. close or cancel transient UI and restore a known state;
7. mark the route `covered` only when its safe subtree is complete; otherwise use `partial` with explicit remaining items.

At minimum, attempt these layers when present:

- initial page state;
- one representative filter or option set;
- one safe primary create/configure/edit entry without final submission;
- one representative row action or detail state;
- pagination, page size, horizontal scroll, and fixed-column behavior;
- one tooltip, popover, drawer, or modal close/cancel flow;
- one safe empty, disabled, loading, or validation state.

Sample repeated controls only when their rendering and text-length risks are equivalent. Mark the rest `duplicate-sampled`.

### 2.2 Scrollable containers

Off-screen content is not automatically a defect. Before reporting a clipped table or tab strip:

1. identify the intended scrollbar, scroll buttons, or fixed-column behavior;
2. scroll in both directions;
3. confirm all important content is reachable and fixed columns do not cover it at reachable positions;
4. compare visible capacity before and after any attempted fix.

Report only unreachable content, unusable scrolling, fixed-column overlap, broken grouped-control styling, or translated text that breaks the intended component.

### 2.3 Blank or incomplete pages

Do not create a finding from the first blank/white/loading state.

1. Confirm the route is missing its expected main content, not merely empty data.
2. Reload the same browser tab.
3. Wait at least 15 seconds and check a page-specific main-content signal.
4. If still blank, reload the same tab a second time.
5. Wait at least 15 seconds again and check the signal.
6. If either reload recovers, continue the normal i18n inspection from the recovered state. Do not list the transient blank state as a finding, blocker, non-i18n observation, or report screenshot.
7. Only if both reloads fail may the route be recorded as a coverage blocker. It is an i18n finding only when evidence ties the failure to locale loading or localized code.

Do not substitute hash re-entry, opening a new tab, or navigating away and back for the required same-tab reloads.

### 2.4 Independent visual review

For broad or high-assurance runs, an independent screenshot review is useful when subagents are available. Split it by route or small screenshot set. Give the reviewer locale, viewport, state, and raw screenshots, but not the primary inspector's suspected findings. The primary agent must triage every observation through Phase 3; reviewer output is never accepted automatically.

## Phase 3: admit or reject observations

An observation becomes a finding only after all four gates pass.

### Gate A: runtime truth

- The problem is visible in the named route and state.
- The screenshot shows the described problem, not a nearby or later state.
- The UI is fully loaded and the target locale is active.
- The behavior is reproducible or otherwise clearly captured.

### Gate B: i18n relevance

Accept when translation, locale convention, target-language length, message rendering, or localized UI layout materially causes the problem.

Reject or separate when it is generic product behavior, ordinary empty data, permissions, a recoverable load state, browser tooling, unrelated runtime failure, or user-created content.

Do not change wording merely because a glossary contains a different term. A wording finding needs inaccurate/unnatural language, inconsistent product meaning, or a demonstrated UI-fit problem.

### Gate C: source and ownership attribution

For every visible unexpected-language string or questionable system label:

1. search the current frontend source and locale files for the exact text and close variants;
2. inspect the component, surrounding labels, and data flow;
3. determine whether the value is local source, local locale data, API/system data, user-created data, shared/external UI, or unknown.

Frontend-leaning system UI includes buttons, menus, tabs, navigation, toolbar actions, form commands, statuses, errors, empty-state instructions, and system enum display names. Treat these as frontend findings when source search confirms local ownership.

User-created data includes file names, project/resource names, custom template names, titles, descriptions, tags, comments, custom fields, and imported record values. A wrong-language user value is not an i18n finding unless the product itself generated or mistranslated it.

For API-returned text:

- exclude it when business logic and the UI flow show it is user-created data;
- mark it `needsHumanConfirmation` when it is fixed system metadata and ownership is backend-leaning or uncertain;
- record the API/data-flow evidence and do not invent a local string-replacement map merely to make the screenshot look fixed.

### Gate D: evidence admission

Open [UI Inspection Evidence](ui-inspection-evidence.md) and complete this transition before assigning an ID or binding evidence to a finding:

```text
saved candidate
  -> captureLedger.pendingPixelReview
  -> primary agent opens the exact saved pixels
  -> captureLedger.admitted -> screenshotManifest -> finding/coverage/report
  OR captureLedger.rejected -> never enters the report
```

Do not treat a successful browser action, DOM snapshot, filename, recapture suffix, image dimensions, or another reviewer statement as pixel admission.

### Finding record

Each accepted finding records:

- ID, title, severity, category, target locale, viewport, URL/state, and reproduction steps;
- expected and actual behavior;
- runtime evidence and accepted screenshot IDs;
- source-search evidence, origin, owner, and user-data assessment;
- fix recommendation, risk, acceptance criteria, and changed files when fixed;
- lifecycle status and release commit used for verification.

Use these lifecycle states:

```text
open -> fixedLocally -> committed -> publishedToPreview -> verifiedFixed
```

Use these terminal or exception states when needed:

```text
verificationFailed
needsHumanConfirmation
notFixableInCurrentRepo
deferred
wontFix
```

`needsHumanConfirmation` remains an `I18N-xxx` finding because the visible system copy is an i18n candidate that still needs ownership confirmation. Keep blockers and non-i18n observations outside the normal `I18N-xxx` sequence.

## Phase 4: select and implement fixes

### 4.1 Fix order

Choose the first option that preserves meaning and component behavior:

1. fix hardcoded text, locale punctuation, missing keys, or wrong locale data;
2. improve inaccurate, unnatural, or needlessly verbose target-locale copy;
3. apply a narrow local width, flex, grid, or label-layout adjustment;
4. change a shared component only when the local problem represents a real shared contract and neighboring usages can be tested;
5. route backend, shared-shell, remote-module, or unknown ownership to the correct owner instead of masking it locally.

A glossary is evidence, not an unconditional replacement source. Preserve product meaning first; when a canonical term is too long for a compact control, choose a natural shorter expression only when context remains unambiguous and record the tradeoff.

### 4.2 Regression gate before accepting a fix

Compare the same locale, viewport, route, interaction state, data state, and scroll position. Reject a fix when any of these is true:

- fewer useful labels, columns, tabs, or controls are visible;
- a neighboring label becomes clipped or a fixed column covers another column;
- a component, editor, chart, action, or validation area disappears;
- the fix only moves the problem to another element;
- wording is less accurate, less grammatical, or no longer matches product meaning;
- a broad CSS change affects unrelated routes without evidence.

For potentially risky layout changes, inspect the target component plus its immediate siblings and one representative populated/empty state.

### 4.3 Code validation

Run validation proportional to the changed code:

- parse changed locale JSON;
- run extraction/synchronization checks when locale files are generated;
- run targeted tests, typecheck, lint, or production build as available;
- run `git diff --check`;
- determine whether failures implicate changed files or are pre-existing.

Update the finding to `fixedLocally` only after the intended code and validation evidence exist.

## Phase 5: release and verify

When the local repository cannot render the authoritative environment, publish through the project's normal preview workflow.

1. Commit and push the exact fix set according to the repository workflow.
2. Record the local commit and remote branch commit.
3. Publish and confirm the release system used that exact commit.
4. Mark affected findings `publishedToPreview`.
5. Open the same route and interaction state in the target environment.
6. Wait for page-specific readiness, not only global-shell text.
7. Capture and admit after evidence under [UI Inspection Evidence](ui-inspection-evidence.md).
8. Compare the target area, immediate neighbors, useful visible capacity, and required component presence.

If the released UI looks correct but every saved after candidate is rejected, leave the finding at `publishedToPreview`; record the rejected candidates and recapture. Do not infer `verifiedFixed` from the live page, source diff, or release success.

If verification fails:

- preserve the failed verification screenshot with a precise reason;
- set `verificationFailed`;
- fix, validate, republish, and reverify;
- do not relabel the failed screenshot as before or final after evidence.

Only the final released commit's accepted screenshot can prove `verifiedFixed`. Earlier-release screenshots may document intermediate history but cannot stand in for final verification.

## Phase 6: finish artifacts and hand off

Use [UI Inspection Evidence](ui-inspection-evidence.md) as the single report/evidence contract.

Before handoff:

- every coverage item has a terminal coverage status;
- every `verifiedFixed` finding has accepted before and final-release after evidence;
- every open or confirmation-required finding has current-state evidence and an owner/follow-up;
- every file referenced by a finding or appendix is `admitted` in `captureLedger`, and no rejected candidate is present in `screenshotManifest`;
- blockers and non-i18n observations are separate and have screenshots when visually observable;
- summary counts match the finding states;
- the screenshot appendix contains filename, capture time, URL/state, action, status, and notes for every admitted screenshot;
- report sample data and mock content are gone;
- code validation and release metadata are recorded;
- the same run folder/report has been reused across loops.

Handoff with the paths to `inspection-log.md`, `report.json`, `report.html`, and `screenshots/`, plus a concise count of found, fixed, verified, and human-attention items. State any browser policy or access limitation without claiming the corresponding interaction was verified.

## Safety boundaries

Explore safe states aggressively, but do not confirm destructive or irreversible actions without explicit authorization.

Avoid final confirmation for delete, remove, archive, disable, publish, payment, send, invite, production settings, or real-data mutation. It is normally safe to open and cancel dialogs, menus, filters, date pickers, dropdowns, pagination, tabs, create/edit drawers before submission, validation states, and detail views.

When an action may mutate data, capture the pre-action state, mark it `skipped-risky`, and record the exact untested action.
