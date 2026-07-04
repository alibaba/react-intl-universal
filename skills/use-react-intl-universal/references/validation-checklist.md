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
- For English target locales, verify casing follows the English Target Locale Rules: Sentence case for ordinary UI copy, Title Case for title-like UI when the product uses title style, proper casing for names/acronyms/months/languages/the pronoun `I`, and no unnecessary all-caps.
- After merge, run `audit-changed-locale-keys.mjs` for the task manifest, or `audit-locale-key.mjs` for a small manual key list.
- Confirm the changed-key audit was run for the current task manifest, not an older generated task set.
- Audit changed keys by default. Do not run full-project scans unless the task is broad, the user asks for it, or the changed-key audit reveals evidence of wider i18n debt.
- Review `length-risk` and `long-translation` warnings from delta review, changed-key audit, or selected full-audit reports as static UI-fit prompts based on estimated display width.
- For changed keys where the non-default translation is wider than the default message in compact UI, inspect the source usage before modifying translations or CSS. Use the key, source line, JSX/source context, component props, `className`, CSS, and layout container to decide risk.
- Check compact grouped controls for visual-integrity risk even when there is no overflow warning. High-risk patterns include tabs, segmented controls, button groups, filter groups, chip groups, badges, pagination, and table action groups that use flex/inline-flex wrapping, collapsed borders, first/last-child radius rules, fixed/min widths, or nowrap child labels.
- For grouped controls, verify or record whether wrapping preserves the whole component: continuous borders, radius only on the outer boundary, clear active/selected state, no isolated row fragments, and stable icon/text/arrow relationships.
- If accurate wording cannot be shortened safely, keep the translation and consider general layout changes such as wrapping, flexible width, or responsive layout before language-specific CSS.
- If static UI-fit risk is uncertain, record a review item with the key, locale, source usage, warning evidence, and next action.
- Run `audit-i18n-contract.mjs --length-warnings` only after broad i18n changes or before a full release-quality locale-pack check, then summarize large JSON reports before acting on length warnings.
- Run `find-hardcoded-cjk.mjs` only when the task includes finding hardcoded Chinese/CJK text.
- Do not treat Browser Use as a daily development requirement. Run Browser Use/UI Inspection Mode only when the user asks for page inspection, provides a page URL for QA, or the task is a release/preflight quality gate; otherwise state in the handoff that Browser Use was not run for the daily workflow.
- In Browser Use/UI Inspection Mode, do not treat "no visible overflow" as a complete pass. Separately report text overflow/truncation, layout overflow, alignment, and component visual integrity coverage; if only overflow metrics were checked, state that visual integrity was not fully verified.
- For broad, full-navigation, release-quality, or high-confidence UI Inspection Mode runs, verify an independent screenshot visual-review pass was run when subagents were available. The inspection folder should contain `visual-reviews/*.md` files, each tied to a route/module/screenshot set.
- Verify the main agent read and triaged every independent visual review report before final report generation. Accepted reviewer observations should become normal findings; dismissed or uncertain observations should have a short rationale or follow-up note in `inspection-log.md`.
- For UI Inspection Mode final `report.html`, verify the display language follows the current conversation language unless the user explicitly requested another report language. The inspected UI target locale may be different from the report language; keep locale codes, URLs, file paths, commands, finding IDs, key names, and code identifiers exact.
- For UI Inspection Mode final `report.html`, verify independent visual-review status is visible: run, partially run, skipped, or unavailable. Include links or paths to `visual-reviews/*.md`, reviewer results, main-agent triage status, linked finding IDs, and dismissal notes when relevant.
- For UI Inspection Mode final `report.html`, verify screenshot thumbnails and coverage-matrix screenshot links open an enlarged preview in the current page and that `Escape`, backdrop click, or a close button closes the preview. Keep image links as no-JavaScript fallbacks.
- For UI Inspection Mode final `report.html`, verify every finding renders screenshot evidence as visible image cards. Fixed findings must use a left/right before-after layout: issue screenshot on the left and verified-fix screenshot on the right. Open or deferred findings should still use a two-column evidence area with the issue screenshot and either follow-up status or additional evidence.
- For UI Inspection Mode final `report.html`, verify screenshots with `screenshotAnnotations` show red-box overlays in image cards/thumbnails and in the enlarged preview. Coordinates should be screenshot-relative percentages, original screenshot files should remain unchanged, and the red boxes should be thin/padded enough that they do not obscure the defect text or UI detail.
- Run the project's available validation commands, but distinguish existing toolchain/dependency failures from failures introduced by the i18n work. Dependency/type-tooling failures are review evidence to classify, not automatic proof that i18n changes are broken.
- Generate handoff evidence and follow unresolved next actions. For normal incremental work, the handoff should primarily explain changed-key sync status, translation review status, static UI-fit review status, remaining review items, changed-key audit results, Browser Use status, and validation status.
