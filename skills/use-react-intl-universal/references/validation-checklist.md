# Validation Checklist

Use the smallest set of checks that proves the changed code is correct. Code and locale behavior are the priority; report QA is secondary and applies only to UI Inspection Mode.

## Source and locale

- Confirm the repository's default locale, extraction flow, helper APIs, key conventions, and generated files before editing.
- Preserve ICU variables, rich tags, `.d()` defaults, and literal key structure.
- Do not add JavaScript interpolation inside translatable messages or new `getHTML` usage for normal React UI.
- Use extraction or locale synchronization when the repository generates locale files; otherwise validate changed JSON directly.
- Review changed target-locale copy for meaning, grammar, casing, punctuation, terminology, and compact-UI fit.

## Fix safety

- Keep the change local unless evidence proves a shared fix is required.
- Preserve each Finding's original fix assessment and ensure every path in the complete `baseline..final` release is included in the separate release assessment; dependency, lockfile, build-config, global-style, shared-component, business-logic, and request-contract changes cannot be called low risk.
- For width, flex, grid, overflow, fixed-column, label, or wording changes, compare the same route/state before and after.
- Reject fixes that expose fewer useful items, hide a component, move clipping to a neighbor, remove an editor/control, or weaken the wording.
- Treat a working table/tab scroll affordance as normal unless content remains unreachable or fixed UI covers it.
- For unexpected-language text, confirm source/API/user-data ownership before fixing.

## Commands

Run the commands relevant to the touched surface:

- locale JSON parse or extraction/synchronization check;
- focused unit/integration tests when available;
- typecheck or lint for changed modules when practical;
- production build for shared or release-bound changes;
- `git diff --check`.

When a command fails, determine whether changed files are implicated. Record unrelated pre-existing failures without presenting them as caused by the fix.
For UI Inspection Mode, execute checks through `run-ui-inspection-validation.mjs` so the raw output, time, exit code, and hash are retained.

## UI Inspection Mode only

- Follow `ui-inspection-mode.md` for coverage, attribution, fixing, and release verification.
- Validate the current report with `validate-ui-inspection-report.mjs --repository <repo>` before every render and handoff.
- Require individually opened, admitted immutable captures and supported claim-level bindings; contact sheets, bulk multi-image renders, rejected, uncertain, mismatched, or stale pixels cannot prove a finding or fix.
- Require comparable before/final state, `verifiedAtCommit` tied to the exact final deployment, exact saved Git diff bytes, field-matched command/publish/reviewer artifacts, and approved isolated finding/release code-risk review before declaring a verified fix.
- Reverify every historical fixed Finding after each final deployment. A current failed validation blocks completion; `failed-pre-existing` remains attention and cannot prove acceptance.
- Keep blockers and non-i18n observations separate; user-created data is not an i18n finding.
- Obtain a fresh independent final report review and a passing report validation artifact before deriving a completed status. If reviewers are unavailable, fail closed as partial or blocked. Report interaction checks are secondary and never replace code, build, release, or product-UI validation.
