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

## UI Inspection Mode only

- Follow `ui-inspection-mode.md` for coverage, attribution, fixing, and release verification.
- Follow `ui-inspection-evidence.md` for every accepted screenshot, annotation, and report update.
- Require each referenced screenshot to be admitted from `captureLedger`; rejected candidates must not enter `screenshotManifest` or the rendered report.
- Every `verifiedFixed` item must use the final released commit and comparable before/after evidence.
- Keep blockers and non-i18n observations separate; user-created data is not an i18n finding.
- Perform the focused artifact-integrity checks from `ui-inspection-evidence.md`; do not let report styling checks substitute for code, build, release, or product-UI validation.
