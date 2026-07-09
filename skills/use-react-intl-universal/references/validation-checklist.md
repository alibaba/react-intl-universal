# Validation Checklist

Use this as a final sanity check before handoff. Prioritize checks that match the current task. For small code or locale changes, do not turn this into a full UI-inspection or report QA pass.

## Code And Locale Changes

- Confirm the repository's i18n conventions before editing: default locale, `.d()` extraction flow, generated locale files, helper APIs, key naming, and visible-copy style.
- Keep ICU placeholders, rich formatter tags, `.d()` defaults, and existing key structure intact. Do not introduce JavaScript string interpolation inside translatable messages.
- Use the repository's extraction, sync, or review scripts when default locale files are generated from source. Do not manually rewrite generated locale output unless the repo has no working script or the user asked for it.
- Review changed keys by default. Run broad locale scans only when the task is broad, the user asks, or changed-key evidence points to wider i18n debt.
- For English target locales, check changed visible copy for casing, terminology, punctuation, and product style.
- Verify no unsafe React UI pattern was introduced, especially `getHTML` for normal React UI, unescaped HTML, or rich formatter code that drops translated `chunks`.

## UI-Fit Risk

- Inspect source usage for changed labels in compact UI: buttons, tabs, menus, filters, badges, table headers, form labels, pagination, and grouped controls.
- Treat clipping, overlap, broken grouping, mid-word breaks, or label/colon/required-marker separation as issues even if DOM overflow checks pass.
- Prefer natural shorter copy or narrow local layout fixes. Avoid broad CSS rewrites, locale-specific branches, or reduced visible capacity unless clearly needed.
- For CSS, flex, width, or overflow fixes, compare before and after. If the fix makes the component show fewer useful items or hides reachable content, stop and retriage.
- For scrollable tabs or tables, do not report off-screen content as a defect when there is a clear working scroll affordance.

## Unexpected Language

- When wrong-language text is visible, first search frontend source and default locale files for exact or near matches.
- Treat buttons, menus, tabs, navigation, toolbar actions, dropdown actions, form commands, statuses, empty states, error messages, and system enum labels as frontend-leaning unless runtime evidence proves remote ownership.
- Treat user-created data such as project names, file names, resource names, titles, descriptions, tags, comments, custom field values, and imported record values as non-i18n unless product evidence says otherwise.
- If text appears API/backend-owned and user-data ownership is unclear, classify it as `needs-product-confirmation` with evidence and a concrete follow-up, not as a confidently fixed issue.

## Browser/UI Inspection When Requested

- Build an upfront coverage inventory, then inspect each reachable in-scope navigation, sidebar, tab, and feature entry depth-first through safe child states. A run that only inspected the default active tab is partial unless the rest is blocked, risky, duplicate, or explicitly out of scope.
- Capture initial evidence and relevant interaction screenshots; click safe first- and second-layer controls instead of stopping at the landing state.
- Separate `I18N-xxx` findings from blockers and non-i18n observations. Keep generic product, permission, routing, backend, and data issues out of normal i18n findings.
- For every fixed finding, re-inspect the affected UI and keep before/after evidence. Do not accept a fix that reduces visible content or degrades layout.
- Treat screenshot annotation as a gate for accepted findings: before evidence needs a visible red box and label by default, and fixed findings need after evidence annotated on the verified region. If annotation is not applicable, record the reason explicitly.
- For skipped risky or blocked interactions, record what was skipped and why.

## Validation Commands

- Run targeted validation available for touched files: JSON parse, extraction/sync checks, changed-key audit, typecheck, build, tests, or lint as appropriate for the repo and change size.
- If validation fails, identify whether touched files are implicated. Existing unrelated toolchain or dependency failures should be recorded as such.
- Run `git diff --check`.

## Artifacts And Report

Only use these checks when UI Inspection Mode produced artifacts.

- Keep `inspection-log.md`, `report.json`, and `report.html` consistent for accepted findings, fixes, blockers, non-i18n observations, screenshot references, and remaining human follow-ups.
- Generate `report.html` from the wireframe and remove obvious sample or template leftovers.
- Keep the screenshot appendix complete enough for human review, including screenshot filename, context, capture time, URL/state, action, notes, and coverage metadata when available. Do not accept generic placeholder actions or filename-derived state as complete appendix metadata.
- For accepted finding evidence, verify `report.json` has matching screenshot annotation data and `report.html` visibly renders red boxes and labels in the inline card and representative enlarged preview. A raw screenshot-only finding card is incomplete unless a no-annotation rationale is recorded.
- Run one lightweight report smoke test when handing off the report. Do not let report layout or interaction checks dominate code validation unless the user explicitly asks for report QA.
