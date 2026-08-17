# UI Inspection Mode

Use this workflow when the user asks to inspect, patrol, audit, fix, or release-verify a localized UI. It covers runtime exploration, source attribution, low-risk remediation, verification in an authorized deployment, and an evidence-backed report.

This reference owns run initialization, evidence admission, independent evidence/code/report review, report rendering, loop reuse and reverification, and completion gates. Read [UI Inspection Evidence](ui-inspection-evidence.md) before creating `report.json` or accepting a screenshot. The executable schema and validator, not prose or the renderer, decide whether a report is internally valid.

## Contents

- [Operating modes](#operating-modes)
- [Hard gates](#hard-gates)
- [Phase 0: initialize one durable run](#phase-0-initialize-one-durable-run)
- [Phase 1: build the risk and coverage inventory](#phase-1-build-the-risk-and-coverage-inventory)
- [Phase 2: inspect depth-first](#phase-2-inspect-depth-first)
- [Phase 3: admit an observation](#phase-3-admit-an-observation)
- [Phase 4: design and implement a low-risk fix](#phase-4-design-and-implement-a-low-risk-fix)
- [Phase 5: publish and verify](#phase-5-publish-and-verify)
- [Phase 6: finalize and obtain human-view approval](#phase-6-finalize-and-obtain-human-view-approval)
- [Safety boundaries](#safety-boundaries)

## Operating modes

Record one authorization in `run.authorization` before changing code:

- `inspect-only`: inspect and report; do not change source, commit, push, or publish.
- `fix-local`: inspect and modify local source; do not push or publish.
- `release-verify`: inspect, fix, commit, push, publish through the repository's authorized non-production release workflow, and verify the resulting deployment.

Do not infer publish authorization from a generic inspection request. Repository-specific runbooks may provide explicit standing authorization.

## Hard gates

1. **Depth-first coverage:** finish the safe child states of one route, menu item, or tab before moving to its sibling.
2. **Observed findings only:** source matches and static length warnings guide exploration but are not findings without visible runtime evidence.
3. **Before evidence precedes edits:** do not edit, stage, or commit product source for a suspected issue until its exact before capture is proven to come from the published baseline commit, admitted from the saved pixels, independently reviewed as supporting the claim, source-attributed, written to `report.json`, and accepted by the validator.
4. **Attribution before remediation:** identify local frontend copy, API system copy, user-created data, shared/external UI, or unknown ownership before choosing a fix.
5. **Claim-level evidence:** every finding claim is bound to an immutable capture, a role-specific annotation, an independent evidence verdict, and the hashed raw reviewer artifact.
6. **Facts derive status:** do not hand-author `verifiedFixed`, verification confidence, summary counts, or final report status.
7. **Risk is a floor:** never claim risk below the risk calculated from the actual diff and independent code review.
8. **No capacity or feature regression:** a fix must not hide controls, editors, tables, charts, labels, columns, tabs, validation, or useful visible range.
9. **Exact deployment provenance:** a mutable branch Preview URL does not prove a commit. Verification evidence must reference a deployment whose build commit equals the current final release commit. Preserve Preview identity in the current capture URL whenever the application allows it. If an SPA removes that query during same-route navigation, record the exact requested state URL plus either an actually loaded resource carrying the identity or an inspectable runtime publication manifest containing the exact identity, release version, and loaded resource list. Hash the raw proof artifact; the current URL must still match the inspected product route/state.
10. **Independent review or fail closed:** preflight distinct evidence, code-risk, and final-report reviewer sessions. If they are unavailable, keep the result partial or blocked; never invent a reviewer or approve your own work.
11. **One run identity:** reuse the first run folder for every loop on the same repository in the same Codex task unless the user explicitly requests a new run.

## Phase 0: initialize one durable run

Record before browser work:

- repository, branch, baseline commit, dirty-state notes, and authorization;
- existing browser/profile requirements and entry URL;
- target locale and report display language;
- actual CSS viewport, device pixel ratio, browser zoom, and screen class;
- account, role, tenant, workspace, and representative test data when relevant;
- Preview/release workflow;
- glossary, product documentation, and environment-specific exclusions.
- availability and identities for three distinct reviewer sessions: evidence, code risk, and final report.

Use the actual desktop viewport. Do not resize the browser to make a defect disappear or claim a larger visible capacity than the user has.

Create the run once:

```bash
node <skill-dir>/scripts/init-ui-inspection-report.mjs \
  --registry-root <absolute-report-registry-root> \
  --run-dir <absolute-report-registry-root>/<repository>/<first-run-id> \
  --run-id <first-run-id> \
  --task-id <current-codex-task-id> \
  --repository <repository> \
  --branch <branch> \
  --baseline-commit <commit> \
  --target-url <url> \
  --target-locale <locale-or-comma-separated-locales> \
  --viewport-width <css-width> \
  --viewport-height <css-height> \
  --device-scale-factor <dpr> \
  --browser-zoom <zoom-ratio> \
  --screen-class <screen-label> \
  --report-language <language> \
  --authorization <inspect-only|fix-local|release-verify> \
  --primary-inspector-id <current-agent-id>
```

This command copies the run-local report template and creates:

```text
<run-directory>/
  inspection-log.md
  report.json
  report.html
  artifacts/
  screenshots/
```

Generate the task token once at the start of the current Codex task and reuse it for every loop. The initializer recursively searches `--registry-root`; the same task/repository returns the existing run as machine-readable output with `reused: true`. It does not create or reject a second timestamped folder. `--target-url` is the canonical product entry known before publishing, not a future Preview URL.

## Phase 1: build the risk and coverage inventory

### Scan source to target runtime states

Use `rg` in the current route family to locate:

- hardcoded source-language strings and locale fallbacks;
- compact controls, long labels, placeholders, menus, status labels, errors, empty states, and enum names;
- fixed widths, locked/fixed table columns, `ellipsis`, overflow, line clamp, wrapping, and word-break rules;
- form-label punctuation and required-marker behavior;
- grouped controls whose border/radius contract breaks when labels wrap;
- shared constants, shared CSS, shared components, dependency/config changes, and locale keys with multiple consumers.

Use source risk only to decide which UI states to inspect. Do not turn search output into a finding.

### Build a source-backed parent/child coverage tree

Before browser exploration, derive the root denominator from route configuration, navigation configuration, registered tabs, or another inspectable product source. Save the raw inventory under `artifacts/coverage/` and record its hash, source references, discovered roots, in-scope roots, and explicit exclusions in `coverageInventory`. Every root coverage record must map to that inventory. Runtime-discovered child states can then extend the tree, but cannot replace the source-backed denominator with only the pages the Agent happened to open.

Open a route or state only through a visible product control, a task-provided canonical URL, or a route/query/hash shape confirmed in current source. Do not invent query parameters or guess hidden routes to increase coverage. A guessed URL that happens to render is not source-backed evidence.

Inventory visible product UI:

- primary and secondary navigation;
- page tabs, side tabs, trees, accordions, and segmented controls;
- filters, selects, search, date controls, pagination, and horizontal scrolling;
- safe create/configure/edit/detail entries without final submission;
- representative row actions, drawers, modals, popovers, tooltips, validation, empty, disabled, and loading states.

Use these statuses:

```text
pending | in-progress | covered | partial | blocked | skipped-risky
duplicate-sampled | external-out-of-scope | not-reached
```

Record a reason for `partial`, `blocked`, `skipped-risky`, `external-out-of-scope`, or `not-reached`. Every node records a renderer key. `duplicate-sampled` is limited to equivalent repeated controls/states with the same target, parent, URL, kind, and renderer key; record both representative and equivalence rationale. Never sample routes, tabs, modals, or drawers. A parent cannot be `covered` while a child remains pending, partial, blocked, or not reached.

## Phase 2: inspect depth-first

For each first-level route or menu item:

1. mark it `in-progress`;
2. open it and wait for a page-specific readiness signal;
3. record canonical route/state, locale, viewport, data state, and scroll state;
4. inventory visible child controls;
5. inspect safe child controls recursively;
6. close or cancel transient UI and restore a known state;
7. mark it `covered` only after the safe subtree is complete.

Treat every hard navigation, route transition, locale switch, reload, and browser-session replacement as a runtime-boundary event. Before saving the next screenshot, re-read and record the current route/state, target locale, CSS viewport, DPR, zoom, readiness, and exact deployment identity. Do not inherit those facts from the previous page. If deployment identity disappeared, restore the same source-backed product state through the deployment URL rules in [UI Inspection Evidence](ui-inspection-evidence.md), wait for readiness again, and verify the runtime proof before capture. A visually correct page from an unproven or different deployment is rejected evidence.

At minimum, attempt when present:

- initial state;
- one representative filter/option state;
- one safe create/configure/edit entry without submission;
- one row detail/action state;
- pagination/page size and both horizontal-scroll extremes;
- one tooltip, popover, drawer, or modal close/cancel flow;
- one empty, disabled, loading, or validation state.

Sample repeated controls only when their renderer, text-length risk, and interaction contract are equivalent.

### Blank or incomplete route

Do not report the first blank/loading frame.

1. Confirm the route is missing its page-specific main content.
2. Reload the same deployment-bound state and wait at least 15 seconds.
3. If still blank, reload the same deployment-bound state a second time and wait at least 15 seconds.
4. If either reload recovers, inspect normally. Do not preserve the transient blank state as a finding, blocker, observation, or report screenshot.
5. If both fail, record a coverage blocker. Treat it as i18n only when evidence connects the failure to locale loading or localized code.

For a Preview or other deployment-identified inspection, "reload the same deployment-bound state" does not mean blindly refreshing a mutable address bar. If navigation removed the deployment identity, reconstruct the same observed source-backed pathname/query/hash through the original deployment URL using a structured URL API, re-request it, and prove the loaded deployment again. Never accept a recovered page when the refresh silently fell back to a shared integration, pre-release, or other build.

## Phase 3: admit an observation

An observation becomes an i18n finding only after all gates pass.

Use these transitions without skipping a state:

```text
runtime observation
  -> evidence candidate
  -> admitted Finding
  -> fix planned
  -> product source edited
```

An evidence candidate belongs only in the inspection log and coverage notes. It must not receive an `I18N-nnn` ID, remediation plan, code change, staging hunk, or commit until the admission checkpoint below passes. Source and DOM inspection may explain what the pixels show, but cannot replace the saved before image.

### Runtime truth

- The named route/state visibly demonstrates the claim.
- The page is ready, the target locale is active, and the state is reproducible.
- The saved pixels, not the live DOM or filename, show the problem.
- The capture records actual device DPR separately from the saved file's sampling scale; Browser Use downsampling is not hidden by changing viewport metadata.

### I18n relevance

Accept when localized wording, punctuation, target-language length, message rendering, locale conventions, or localized layout materially causes the defect.

Reject or separate ordinary product behavior, empty data, permission failures, recoverable loading, browser tooling, unrelated runtime errors, and user-created values.

Do not create a terminology finding merely because a glossary uses another phrase. Require inaccurate or unnatural language, changed business meaning, inconsistent product terminology, or a demonstrated UI-fit defect.

### Ownership

For unexpected-language or questionable system copy:

1. search exact text and close variants in source and locale files;
2. inspect component and data flow;
3. classify `frontend-source`, `frontend-locale-data`, `frontend-locale-fallback`, `api-system-copy`, `api-user-created-data`, `external-module`, or `unknown`;
4. record searched terms, matches, owner, user-data assessment, and rationale.

Buttons, menus, tabs, navigation, form commands, statuses, errors, empty-state instructions, and enum display names lean frontend only when source search confirms local ownership.

File names, project/resource names, custom template names, titles, descriptions, tags, comments, custom fields, and imported record values usually lean user-created. Do not create an i18n finding for user-created data.

For fixed API system copy with uncertain ownership, use `needs-human-confirmation`; do not build a local replacement map to make the screenshot look translated.

### Evidence and independent reading

Follow [UI Inspection Evidence](ui-inspection-evidence.md):

1. save and register a capture;
2. open that exact saved file by itself at original detail and admit or reject it; never decide from a contact sheet or bulk multi-image rendering;
3. create a claim-specific evidence binding;
4. give that one raw saved image, proposed claim, locale, and state to an independent reviewer without the primary inspector's expected verdict;
5. record `supports`, `does-not-support`, or `uncertain` plus observed text and rationale;
6. create the `I18N-nnn` finding only when an `issue-detail` binding receives `supports`.

An element clip requires a supported `issue-context` full-viewport binding. A full-viewport screenshot may serve directly as `issue-detail` when the target is human-readable at original pixels.

If the review surface shows black blocks, missing layers, or a suspicious composite, reopen the exact file individually and preserve both raw results. Reject persistent corruption; do not reject or approve saved pixels solely from a transient multi-image viewer artifact.

### Baseline admission checkpoint before any code edit

Before opening product source for modification, freeze the Finding's baseline evidence package in `report.json`:

- the baseline deployment is `published` and its build commit equals `run.baselineCommit`;
- the exact saved full-viewport or context-plus-detail pixels visibly prove the claim;
- capture URL or deployment identity proof, target locale, viewport, DPR, zoom, state snapshot, readiness, hash, MIME, dimensions, and capture time are recorded;
- pixel admission passed after opening the saved file at original detail;
- an independent evidence reviewer returned `supports` for the exact claim and annotation;
- source attribution and user-created-data assessment are complete;
- the `finding-admitted` lifecycle event occurs after capture admission and independent evidence review;
- the in-progress `report.json` passes structural and semantic validation.

Only after this checkpoint may the lifecycle advance to `fix-planned` and product source editing begin. Keep the evidence package immutable. If the exact baseline cannot reproduce the issue, the reviewer returns `does-not-support` or `uncertain`, the deployment identity is not proven, or the validator fails, reject the candidate and do not remediate it. If code was already changed for such a candidate, remove that change from the release rather than manufacturing replacement before evidence afterward.

## Phase 4: design and implement a low-risk fix

### Select the narrowest semantically correct option

1. fix hardcoded copy, locale punctuation, missing keys, or wrong locale data;
2. improve inaccurate, unnatural, or needlessly verbose target-locale wording;
3. apply a local leaf-component layout adjustment;
4. change shared display behavior only when the defect is truly shared and all affected consumers can be checked;
5. route backend, shared-shell, remote-module, or unknown ownership to the correct owner.

Do not shorten correct copy only to conceal a layout defect. Do not expand a global selector to fix one component. Do not add language-independent whitespace when punctuation or spacing belongs to the locale message.

When shorter copy is a legitimate part of the fix, review it as language before treating it as geometry: preserve the business meaning, grammatical number, workflow state, and distinction from neighboring labels. Compare the candidate against its source/default message, glossary context, all locale-key consumers, and the value or action it labels. A string that fits but changes meaning is a failed fix. Prefer natural compact wording; use an abbreviation only when it is conventional and still unambiguous in that product context.

Before editing, search for duplicate route, package, module, feature-flag, or legacy implementations of the same visible surface. If the changed helper, message, type, or component has more than one consumer or build entry, include every affected implementation in the fix assessment and run the relevant build or focused check for each one. A fix that updates only the first matching implementation is incomplete; a shared change whose other consumers were not inspected cannot be called low risk.

### Produce finding and release risk from Git

Prefer one finding per commit. Group findings only when they share one inseparable root cause and the same affected consumers; otherwise a convenient batch increases the release blast radius and usually prevents a low-risk conclusion even when each visible fix is small.

After a candidate fix is committed, generate its original finding-scoped facts and save the exact diff bytes:

```bash
node <skill-dir>/scripts/collect-ui-fix-evidence.mjs \
  --repository <repository> \
  --base <commit-before-this-fix> \
  --fix <commit-that-introduced-this-fix> \
  --report-root <run-directory> \
  --diff-artifact artifacts/diffs/<finding-id>.diff \
  --scope finding
```

The generated classification is intentionally conservative. Read every diff and only narrow `changeKind`, affected surfaces, and risk factors when the code proves a smaller blast radius. The recorded changed-file set must equal the actual diff exactly; omitted files invalidate the report.

Do not rewrite that Finding assessment in later loops. Before each release candidate, separately generate top-level `releaseAssessment` for the complete current release:

```bash
node <skill-dir>/scripts/collect-ui-fix-evidence.mjs \
  --repository <repository> \
  --base <run-baseline-commit> \
  --fix <current-final-release-commit> \
  --report-root <run-directory> \
  --diff-artifact artifacts/diffs/release-<final-commit>.diff \
  --scope release \
  --finding-ids <all-findings-with-code-fixes>
```

The release assessment must cover exactly `run.baselineCommit..run.finalCommit`, list every fixed Finding, and reference current passing validations. This preserves each Finding's original change history while making the complete cumulative release auditable.

Risk floors:

- high: dependency/lock/config/runtime, global CSS, shared foundations, business logic, request contracts, cross-module or unknown blast radius;
- medium: local layout, table geometry, shared display maps, multi-consumer messages, or cross-locale rendering;
- low: isolated leaf copy, locale-owned punctuation, or a display-only constant with no shared behavior.

To move risk toward low, redesign the fix to reduce its scope. Tests do not convert a global or behavioral change into a low-scope change.

### Reuse source/locale validation

When a UI finding modifies react-intl-universal messages or locale files, also follow the relevant daily workflow steps from `SKILL.md`: source-of-truth `.d()` update, extraction when configured, changed-key synchronization, ICU/tag contract checks, target-language review, and changed-key audit.

Run proportional code checks and record structured validation entries. Preserve raw output with:

```bash
node <skill-dir>/scripts/run-ui-inspection-validation.mjs \
  --id <validation-id> \
  --scope <source|locale|test|build|git|runtime|release|report> \
  --report-root <run-directory> \
  --artifact artifacts/validations/<validation-id>.json \
  --cwd <repository> \
  -- <command> <arguments...>
```

A command summary without its execution time, exit code, and hashed raw output is not sufficient.

### Independent code-risk review

Before marking verification passed, give an independent SubAgent that is not the primary inspector:

- repository path and exact base/fix commits;
- actual diff and changed tests;
- relevant glossary/context files;
- no desired risk conclusion.

Require it to identify business, request, shared-component, CSS, dependency, cross-locale, editor/table/form, and missing-test regressions. Preserve the raw review under `artifacts/reviews/`, then record its exact report-compatible `finding` or `release` scope, complete finding ID set, `subagent` or `human` reviewer type, reviewer ID, unique review session ID, exact commits/diff hash, artifact hash, structured P0-P3 findings, and one string notes field. The validator compares these fields with the raw artifact exactly; do not normalize aliases, arrays, or missing IDs only during report assembly. The code reviewer and session must differ from evidence review. Review may happen before push. Unresolved P0/P1 blocks verification. An unresolved P2 blocks a `low` risk claim.

## Phase 5: publish and verify

For `release-verify` runs:

1. commit and push the exact fix set;
2. publish through the repository's authorized Preview workflow;
3. preserve the raw publish/provenance output under `artifacts/deployments/`, then record its hash, provider, publish/build IDs, build commit, Preview URL, publish time, command, and result summary;
4. verify the deployment build commit equals `run.finalCommit`, the run-level release assessment covers `run.baselineCommit..run.finalCommit`, and its independent release review is approved;
5. navigate to the exact product state from the recorded fix deployment Preview URL, preserving its Preview identity query, then restore the same state key, locale, viewport, data state, and scroll state; if the SPA removes the query, save `deploymentIdentityProof` with the exact requested state URL and either an actually loaded identity-bearing resource or a matching runtime publication manifest, plus the hashed raw proof artifact; never reuse a baseline deployment identity for final evidence;
6. wait for page-specific readiness;
7. inspect the original region, immediate neighbors, useful capacity, and key component presence. Treat the opened saved pixels as the final visual fact: DOM `scrollWidth`, computed styles, bounding boxes, and text measurements are diagnostics only. Sticky/fixed columns, masks, transforms, clipping ancestors, overlays, and z-index can hide content even when DOM metrics report enough width;
8. capture, open, admit, bind, and independently review final evidence;
9. reverify every previously fixed Finding on this latest deployment and set each `verification.verifiedAtCommit` to `run.finalCommit`; never carry an older after screenshot forward as current proof.

Every passed visual acceptance check must reference supported `verification-context`, `verification-detail`, or `regression-check` evidence. Before evidence cannot satisfy a final acceptance check. Truncation, overflow, overlap, alignment, component-integrity, word-break, form-label, and interaction fixes require a separate `regression-check` claim that identifies the protected neighbor, component, or visible capacity; do not overload the “problem disappeared” claim.

The final Preview and regression claims may reference the same admitted full-viewport capture when that one image visibly proves both. Keep the bindings and reviews separate, but render the shared capture only once in the Finding's After column. Use distinct captures only when the claims require different states, viewports, locales, or visible regions.

If final evidence is clipped, add a supported full-viewport `verification-context`. If verification fails, bind the actual released failure as `failed-verification`, keep it separate from baseline evidence, fix again, republish, and reverify.

If an evidence or final-report reviewer finds a stale, swapped, irrelevant, unreadable, or wrongly annotated screenshot, invalidate the affected final binding and reopen the Finding. Correct the product, state reconstruction, capture, claim, or status, then repeat admission, independent evidence review, Preview verification, report validation, and final review. Do not obtain approval by editing only the caption or annotation when the saved pixels do not prove the claim.

## Phase 6: finalize and obtain human-view approval

1. Resolve all pending captures and active coverage. Use `complete-candidate` only when coverage is complete; use `partial` or `blocked` with explicit terminal coverage reasons when a complete inspection is impossible.
2. Ensure every passed acceptance check has matching final visual evidence or a passing validation record.
3. Set `run.status` to `complete-candidate`, `partial`, or `blocked`; do not add `reviews.finalReport` yet. A current failed validation blocks `complete-candidate`; a documented `failed-pre-existing` validation remains human attention and cannot support acceptance. Freeze substantive report data, `revision`, and `run.updatedAt` at this point.
4. Run the validator and renderer from the run-local template. Preserve the report check output as a `scope: report` validation artifact before asking for final approval. This report-scope check intentionally runs after the frozen `run.updatedAt`; do not advance `run.updatedAt` merely to admit it. Source, locale, test, build, Git, runtime, and release validations must still predate the frozen report state:

```bash
node <skill-dir>/scripts/validate-ui-inspection-report.mjs \
  --report-json <run-directory>/report.json \
  --repository <repository> \
  --json

node <skill-dir>/scripts/render-ui-inspection-report.mjs \
  --report-json <run-directory>/report.json \
  --output <run-directory>/report.html \
  --repository <repository>

node <skill-dir>/scripts/run-ui-inspection-validation.mjs \
  --id <report-validation-id> \
  --scope report \
  --report-root <run-directory> \
  --artifact artifacts/validations/<report-validation-id>.json \
  --cwd <repository> \
  -- node <skill-dir>/scripts/validate-ui-inspection-report.mjs \
    --report-json <run-directory>/report.json \
    --repository <repository> \
    --json
```

5. Add the returned report validation record to `report.json`, validate and render the resulting draft, then give a fresh SubAgent that did not perform evidence or code-risk review only the rendered report, `report.json`, and saved screenshots. Ask it to review every finding as a human reader: claim/image/annotation consistency, before/after comparability, acceptance coverage, provenance, and whether fix risk is understandable.
6. Preserve the raw final review under `artifacts/reviews/`. Record its distinct reviewer/session identity, artifact hash, `coverageAssessable`, `artifactUsable`, structured finding results, the validator's `reviewableContentSha256`, and current `revision` in `reviews.finalReport`.
7. Validate and render again. An approved `complete-candidate` report derives `completed` or `completed-with-attention`; approved `partial` and `blocked` reports retain those honest statuses. Do not store a derived completed status as a manual run status.
8. After the freeze, only the matching report-validation record and matching final-review record may be inserted without changing the revision or update time. Any other report, evidence, annotation, renderer, template, CSS, or JavaScript change invalidates both records: increment `revision`, set a new `run.updatedAt`, remove stale report validation and final review, render a new draft, and repeat validation and independent review.

Capture raw screenshots without baked-in red boxes or labels. Store annotations on evidence bindings so the renderer can present each claim accurately in previews and lightboxes.

The final reviewer must use `changes-requested` or `uncertain` when any finding is mismatched, insufficient, unreadable, or not risk-assessable. Do not edit the report merely to obtain an approval verdict; correct the underlying evidence, finding, fix, or status.

## Safety boundaries

Explore safe states aggressively, but do not confirm destructive or irreversible actions without explicit authorization.

Do not submit delete, remove, archive, disable, production publish, payment, send, invite, or real-data mutation actions. It is normally safe to open and cancel dialogs, menus, filters, dropdowns, pagination, tabs, create/edit drawers before submission, validation states, and detail views.

When an action may mutate data, record `skipped-risky`, capture the pre-action state when useful, and state the exact untested action.
