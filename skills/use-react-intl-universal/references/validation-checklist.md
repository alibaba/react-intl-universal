# Validation Checklist

Before finishing changes:

- Run project discovery in unfamiliar repositories and follow existing extraction scripts before generic commands.
- Verify `.d()` uses ICU placeholders instead of JavaScript interpolation for translatable values.
- Run the repository extraction command or `react-intl-universal-extract` when default locale files are generated from `.d()`.
- After extraction/export, run `verify-locale-export.mjs` for every expected locale file and plausible key counts; do not rely on exit code alone.
- Verify no new `getHTML` usage was introduced for React UI.
- Verify rich formatter examples render the translated `chunks`.
- Infer or confirm the default locale before changing translated locale files.
- Generate translation tasks for changed default-locale keys instead of translating entire locale files.
- Run `review-translation-deltas.mjs` before applying subagent or human translation deltas.
- Generate `create-translation-review-tasks.mjs` when delta review reports warnings, or use `--include-all` for a deliberate naturalness/terminology pass.
- After merge, run `audit-changed-locale-keys.mjs` for the task manifest, or `audit-locale-key.mjs` for a small manual key list.
- Confirm the changed-key audit was run for the current task manifest, not an older generated task set.
- Audit changed keys by default. Do not run full-project scans unless the task is broad, the user asks for it, or the changed-key audit reveals evidence of wider i18n debt.
- Review `length-risk` and `long-translation` warnings from delta review, changed-key audit, or selected full-audit reports as static UI-fit prompts based on estimated display width.
- For changed keys where the non-default translation is wider than the default message in compact UI, inspect the source usage before modifying translations or CSS. Use the key, source line, JSX/source context, component props, `className`, CSS, and layout container to decide risk.
- If accurate wording cannot be shortened safely, keep the translation and consider general layout changes such as wrapping, flexible width, or responsive layout before language-specific CSS.
- If static UI-fit risk is uncertain, record a review item with the key, locale, source usage, warning evidence, and next action.
- Run `audit-i18n-contract.mjs --length-warnings` only after broad i18n changes or before a full release-quality locale-pack check, then summarize large JSON reports before acting on length warnings.
- Run `find-hardcoded-cjk.mjs` only when the task includes finding hardcoded Chinese/CJK text.
- Do not treat Browser Use as a daily development requirement. Run Browser Use/UI Inspection Mode only when the user asks for page inspection, provides a page URL for QA, or the task is a release/preflight quality gate; otherwise state in the handoff that Browser Use was not run for the daily workflow.
- Run the project's available validation commands, but distinguish existing toolchain/dependency failures from failures introduced by the i18n work. Dependency/type-tooling failures are review evidence to classify, not automatic proof that i18n changes are broken.
- Generate handoff evidence and follow unresolved next actions. For normal incremental work, the handoff should primarily explain changed-key sync status, translation review status, static UI-fit review status, remaining review items, changed-key audit results, Browser Use status, and validation status.
