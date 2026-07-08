# Script Reference

Use these scripts when the repository has locale JSON files and deterministic i18n checks are useful.
All scripts use only Node.js standard library modules. The display-width helper used for daily static UI-fit risk review is bundled under `scripts/lib/display-width.mjs`; it follows the default behavior of `string-width` closely enough for lightweight localization review, but does not require installing `string-width` or any other npm package. These display-width warnings are static review prompts, not browser pixel measurements or proof that a real layout will break. They also do not prove component visual integrity: a tabs/segmented-control/button-group/chip-group can have no text overflow and still look broken if same-group items wrap and borders, radius, active state, or icon/text/arrow relationships no longer form one coherent control.

UI Inspection Mode report generation is usually performed by the agent for the active run rather than by a bundled script. If you create or edit a local report generator for a run, keep it aligned with [UI Inspection Mode](ui-inspection-mode.md), [UI Inspection Report Types](ui-inspection-report-types.ts), and [UI Inspection Report Wireframe](ui-inspection-report-wireframe.html). Do not duplicate report layout rules here; use the wireframe as the structural and interaction reference. The generator should still enforce data contracts: referenced screenshots exist, `report.json` fields match the TypeScript contract, screenshot annotations use screenshot-relative percentages, empty code-diff blocks are omitted, non-i18n observations stay separate from normal findings, and blank pages are not called i18n defects without supporting diagnostics.

After generating or editing `report.html`, run the no-dependency inline-script syntax smoke test from [UI Inspection Mode](ui-inspection-mode.md). When browser access is available, open the report and spot-check the wireframe interactions instead of maintaining a separate interaction checklist here. If browser access to the local file is blocked, state that browser interaction verification was unavailable.
Set `SKILL_DIR` to the absolute path of the directory that contains this skill's `SKILL.md`:

```bash
export SKILL_DIR=/absolute/path/to/use-react-intl-universal
```

## Table of Contents

- [Discover Existing I18n Setup](#discover-existing-i18n-setup)
- [Daily Development Changed-Key Workflow](#daily-development-changed-key-workflow)
- [Export Verification](#export-verification)
- [Default Locale](#default-locale)
- [Key Audit](#key-audit)
- [Translation Tasks](#translation-tasks)
- [Translation Delta Review](#translation-delta-review)
- [Translation Quality Review Tasks](#translation-quality-review-tasks)
- [Delta Merge](#delta-merge)
- [Changed-Key Audit](#changed-key-audit)
- [Contract Audit](#contract-audit)
- [Audit Fix Tasks](#audit-fix-tasks)
- [Hardcoded CJK](#hardcoded-cjk)
- [Handoff](#handoff)
- [Self Test](#self-test)

## Discover Existing I18n Setup

```bash
node "$SKILL_DIR/scripts/discover-project-i18n.mjs" \
  --source src \
  --locales src/locales \
  --expected-locales zh_CN,en_US,zh_TW
```

Use this first in unfamiliar repositories. It reports relevant `package.json` scripts, installed i18n dependencies, locale files, extraction export languages, command availability, expected-locale support in known locale provider/UI/date packages, and source files that wire locale imports or providers. For normal copy, extraction, translation, or audit work, use it to understand the existing setup.

## Daily Development Changed-Key Workflow

For ordinary product-copy work, keep the workflow scoped to keys changed by the default-locale diff:

```bash
# 1. Discover the current i18n setup.
node "$SKILL_DIR/scripts/discover-project-i18n.mjs" \
  --source src \
  --locales src/locales \
  --json > tmp/i18n-discovery.json

# 2. Run the repository's own extraction/export command, then verify output.
npm run intl:extract
node "$SKILL_DIR/scripts/verify-locale-export.mjs" \
  --locales src/locales \
  --expected-locales zh_CN,en_US,zh_TW \
  --reference-locale zh_CN \
  --json > tmp/i18n-export-verify.json

# 3. Generate translation tasks from the default-locale diff only.
node "$SKILL_DIR/scripts/create-translation-tasks.mjs" \
  --source src \
  --locales src/locales \
  --default-locale zh_CN \
  --base-ref origin/master \
  --sort source \
  --output tmp/i18n-translation-tasks

# 4. Review returned translation delta JSON before merging.
node "$SKILL_DIR/scripts/review-translation-deltas.mjs" \
  --source src \
  --locales src/locales \
  --default-locale zh_CN \
  --tasks tmp/i18n-translation-tasks/manifest.json \
  --deltas tmp/i18n-translation-results \
  --json > tmp/i18n-delta-review.json

# 5. Merge reviewed deltas, then audit only the changed keys.
node "$SKILL_DIR/scripts/apply-translation-deltas.mjs" \
  --locales src/locales \
  --deltas tmp/i18n-translation-results \
  --default-locale zh_CN \
  --json > tmp/i18n-apply-result.json

node "$SKILL_DIR/scripts/audit-changed-locale-keys.mjs" \
  --tasks tmp/i18n-translation-tasks/manifest.json \
  --locales src/locales \
  --default-locale zh_CN \
  --json > tmp/i18n-changed-key-audit.json
```

This path covers adding keys and modifying default messages. It still includes translation, deterministic review, merge, changed-key audit, and static UI-fit review of changed-key length warnings. It does not scan unrelated hardcoded text or run Browser Use by default.

## Export Verification

```bash
node "$SKILL_DIR/scripts/verify-locale-export.mjs" \
  --locales src/locales \
  --expected-locales zh_CN,en_US,zh_TW,ja_JP \
  --reference-locale zh_CN \
  --min-ratio 0.9
```

Use this after any extraction/export command whose success matters. It checks generated files, not shell exit code. If a batch export misses locales and an individual retry succeeds, run this script against the final directory that will be committed or deployed.

## Default Locale

```bash
node "$SKILL_DIR/scripts/infer-default-locale.mjs" \
  --source src \
  --locales src/locales
```

Use this before changing translated locale files when the default locale is not obvious.

## Key Audit

```bash
node "$SKILL_DIR/scripts/audit-locale-key.mjs" \
  --key WELCOME_USER \
  --locales src/locales
```

Use this before changing an existing key or when manually checking a small number of keys. It reports each locale file, line number, whether the key exists, and whether `{variable}` or `<tag>` usage differs from the baseline locale. For a normal task generated by `create-translation-tasks.mjs`, prefer [Changed-Key Audit](#changed-key-audit) after merge because it reads the full changed-key set from the task manifest.

## Translation Tasks

```bash
node "$SKILL_DIR/scripts/create-translation-tasks.mjs" \
  --source src \
  --locales src/locales \
  --default-locale en-US \
  --context-file docs/glossary.md \
  --base-ref origin/master \
  --output tmp/i18n-translation-tasks
```

If the default locale is unknown, pass `--source src --infer-default-locale` instead of `--default-locale en-US`.
For normal incremental work, pass a real `--base-ref` such as `origin/master`; without it, all current default-locale keys are treated as new tasks. Use the repository's default branch or the branch that represents the last synchronized locale state.

By default, the script creates tasks for existing non-default locale files. When the user explicitly asks to produce tasks for a target locale file that does not exist yet, `--target-locales` can point at that locale:

```bash
node "$SKILL_DIR/scripts/create-translation-tasks.mjs" \
  --source src \
  --locales src/locales \
  --default-locale zh_CN \
  --target-locales ja_JP \
  --max-items-per-task 1000 \
  --sort source \
  --output tmp/i18n-translation-tasks
```

This writes batch files such as `ja_JP.part-001.json`, `ja_JP.part-002.json`, and matching Markdown files when the work is large. Multiple delta files for the same `locale` are safe; `apply-translation-deltas.mjs` merges them into one locale JSON file. The manifest reports Markdown/JSON task file sizes and warns when batches are too large for reliable agent handoff. If `taskSize.warnings` is non-empty, rerun with the recommended smaller `--max-items-per-task` before assigning work to subagents.
When `--source` is provided, each task item includes source file/line, source code line, compressed source-call text, nearby source context, and a `uiRisk` hint for static UI-fit review. Task items also include existing non-target locale translations when available, so translators can reuse project terminology without treating those references as the contract. Use `--sort source` for large apps so each batch stays closer to a product area and is easier for a subagent to translate consistently. The generated task instructions require meaning-first translation: inspect nearby code when needed, identify the business action/object/status, understand the product flow in the current codebase, and write natural target-locale product copy instead of word-by-word translation. For compact grouped controls, inspect source context for wrapped grouped-control visual integrity risk, especially flex/inline-flex groups with wrapping, child buttons/tabs/chips, collapsed borders, first/last-child radius rules, fixed/min widths, or nowrap labels. For English target locales, task instructions also include explicit casing rules for Sentence case, Title Case, proper names and terms, acronyms/initialisms, the pronoun `I`, and all-caps limits.

When the user provides extra context such as a glossary, terminology guide, style guide, product document, screenshot notes, or page URLs, pass each text file with repeatable `--context-file`. The script embeds those assets in the JSON and Markdown task files as reference evidence. Use them for terminology and writing decisions, but keep the default message contract authoritative for ICU variables, rich tags, and current product meaning. Do not expand task context by scanning unrelated project documents unless the user asks for it.

## Translation Delta Review

```bash
node "$SKILL_DIR/scripts/review-translation-deltas.mjs" \
  --source src \
  --locales src/locales \
  --default-locale zh_CN \
  --tasks tmp/i18n-translation-tasks/manifest.json \
  --deltas tmp/i18n-translation-results \
  --json > tmp/i18n-delta-review.json
```

Use this before merging returned translations. It checks deterministic quality risks: missing task keys, invalid delta shapes, default-locale edits, ICU/rich-tag contract mismatches, untranslated copies of the default message, unexpected CJK text in non-CJK locales, and medium/high static UI-fit length risks. Warnings are review prompts; issues must be fixed before merge. Length warnings mean the agent should inspect source usage and decide whether the translation, layout, grouped-control visual integrity, or a review note is appropriate; they are not automatic shortening instructions. Rerun this report whenever translation tasks are regenerated; `create-i18n-handoff.mjs` compares the current task manifest count with `expectedItemCount` and will flag outdated delta review reports.

## Translation Quality Review Tasks

```bash
node "$SKILL_DIR/scripts/create-translation-review-tasks.mjs" \
  --review tmp/i18n-delta-review.json \
  --tasks tmp/i18n-translation-tasks/manifest.json \
  --deltas tmp/i18n-translation-results \
  --output tmp/i18n-translation-review-tasks \
  --json > tmp/i18n-translation-review-tasks-output.json
```

Use this after `review-translation-deltas.mjs` when returned translations need subjective review for naturalness, terminology, business meaning, or static compact UI fit. It converts deterministic review warnings plus task context into small Markdown/JSON review queues. It does not edit locale files, does not run Browser Use, and does not claim a translation is wrong automatically.

To review every returned translation instead of only deterministic warnings:

```bash
node "$SKILL_DIR/scripts/create-translation-review-tasks.mjs" \
  --review tmp/i18n-delta-review.json \
  --tasks tmp/i18n-translation-tasks/manifest.json \
  --deltas tmp/i18n-translation-results \
  --include-all \
  --output tmp/i18n-translation-review-tasks
```

Use `--include-ui-risk high,medium` to force compact UI translations into review even when deterministic checks pass. The generated tasks ask reviewers to inspect source context, preserve ICU/rich-tag contracts, verify terminology, and prefer concise natural wording only when it does not harm meaning. For English review tasks, they also ask reviewers to check Sentence case, Title Case, proper names and terms, acronyms/initialisms, the pronoun `I`, and unnecessary all-caps.

## Delta Merge

```bash
node "$SKILL_DIR/scripts/apply-translation-deltas.mjs" \
  --locales src/locales \
  --deltas tmp/i18n-translation-results \
  --default-locale en-US
```

When `--default-locale` is provided, the merge validates each translation before writing:

- String translations must preserve every ICU variable and rich tag.
- New string translations must point to a key that still exists in the default locale.
- By default, no locale file is written if any delta entry is skipped. Use `--allow-partial` only when writing valid entries while keeping a non-zero exit for skipped entries is acceptable.

## Changed-Key Audit

```bash
node "$SKILL_DIR/scripts/audit-changed-locale-keys.mjs" \
  --tasks tmp/i18n-translation-tasks/manifest.json \
  --locales src/locales \
  --default-locale zh_CN \
  --json > tmp/i18n-changed-key-audit.json
```

Use this after merging translation deltas. It reads the changed-key set from `create-translation-tasks.mjs`, then checks only those keys across the default locale and existing non-default locales. It verifies:

- added/changed keys exist in every audited locale;
- ICU `{variable}` contracts match the default message;
- rich tag `<tag>` contracts match the default message;
- non-default translations with static UI-fit length risk in compact UI are reported as warnings.

Warnings are static UI-fit review prompts, not automatic edit instructions, browser layout proof, or component visual-integrity proof. Inspect the source usage before shortening a translation or changing CSS. If a translation cannot be shortened without losing meaning, keep the accurate translation and consider general layout changes. For tabs, segmented controls, button groups, chip groups, badges, pagination, filter groups, and table action groups, avoid free wrapping inside a joined visual group unless the border/radius/active-state rules are deliberately redesigned for the wrapped shape.

## Contract Audit

```bash
node "$SKILL_DIR/scripts/audit-i18n-contract.mjs" \
  --source src \
  --locales src/locales \
  --default-locale en-US \
  --length-warnings \
  --json > tmp/i18n-audit.json

node "$SKILL_DIR/scripts/summarize-i18n-audit.mjs" \
  --report tmp/i18n-audit.json
```

Use this for broad migration, release-quality checks, or explicit full-project audits. It is not the default completion condition for an ordinary changed-key task.

The audit reports missing locale keys, conflicting `.d()` defaults for the same key, `{variable}` or `<tag>` contract mismatches, JavaScript template interpolation inside `.d()`, new `intl.getHTML` usage, and optional non-default translation length risk. Its message count is the number of source `intl.get(...).d(...)` contract entries scanned, not the number of keys in a locale JSON file. Use the summary to fix hard errors before advisory static UI-fit warnings. Length-warning examples include source usage when available; inspect that source before shortening text or changing CSS.

If docs, demos, or code snippets contain sample `intl.get` calls, exclude them:

```bash
node "$SKILL_DIR/scripts/audit-i18n-contract.mjs" \
  --source src \
  --locales src/locales \
  --ignore docs/,demo.tsx
```

## Audit Fix Tasks

```bash
node "$SKILL_DIR/scripts/create-audit-fix-tasks.mjs" \
  --audit tmp/i18n-audit.json \
  --source src \
  --locales src/locales \
  --default-locale en-US \
  --output tmp/i18n-audit-fix-tasks \
  --max-items-per-task 20
```

This groups raw audit blockers into focused task files. Missing-locale-key issues are grouped by key across locales, while conflicting defaults and contract mismatches keep their source or locale locations. The manifest reports both `hardBlockerTaskCount` and source issue coverage such as `hardBlockerCoveredIssueCount/hardBlockerIssueCount`; use coverage to verify the generated task queue covers every raw audit blocker. With `--source` and `--locales`, task items also include source `.d()` defaults, source occurrences, current locale values, variable/tag contracts, suggested default-locale values for missing keys, translation prompts for missing non-default locale values, and conservative suggested locale values for simple ICU variable-name mismatches.

To generate optional advisory tasks for JavaScript template interpolation inside `.d()`, pass:

```bash
node "$SKILL_DIR/scripts/create-audit-fix-tasks.mjs" \
  --audit tmp/i18n-audit.json \
  --source src \
  --locales src/locales \
  --default-locale en-US \
  --include-warnings template-default-message \
  --output tmp/i18n-audit-fix-tasks-with-template-warnings
```

Template-default task items include the suggested ICU default. If a template variable is not present in the `intl.get(..., values)` object, the task reports `Missing intl.get values`; add those values while migrating the `.d()` string.

To generate optional advisory tasks for deprecated React UI `intl.getHTML` usage, pass:

```bash
node "$SKILL_DIR/scripts/create-audit-fix-tasks.mjs" \
  --audit tmp/i18n-audit.json \
  --source src \
  --include-warnings deprecated-getHTML \
  --warnings-only \
  --output tmp/i18n-gethtml-migration-tasks
```

These tasks are migration queues, not automatic rewrites. Prefer rich tag formatters with `intl.get` for React UI, keep a full sentence in one message, and leave documented legacy non-React HTML-string plumbing only when migration is not appropriate.

To generate static UI-fit review tasks for translations with compact UI length warnings, pass `long-translation`. Prefer starting with high-severity items:

```bash
node "$SKILL_DIR/scripts/create-audit-fix-tasks.mjs" \
  --audit tmp/i18n-audit.json \
  --source src \
  --locales src/locales \
  --default-locale en-US \
  --include-warnings long-translation \
  --warning-severity high \
  --warnings-only \
  --output tmp/i18n-length-review-tasks
```

Long-translation tasks are static UI-fit review queues, not automatic edit instructions. `--warnings-only` keeps this queue separate from hard-blocker audit fix tasks. Inspect the source usage first, then either shorten the non-default translation naturally or adjust nearby layout when accurate wording cannot be shortened safely.
When generating a final handoff, pass this manifest separately with `--length-review-tasks` so UI length review is tracked apart from audit hard blockers.

## Hardcoded CJK

```bash
node "$SKILL_DIR/scripts/find-hardcoded-cjk.mjs" \
  --source src \
  --json > tmp/i18n-hardcoded-cjk.json

node "$SKILL_DIR/scripts/create-hardcoded-cjk-fix-tasks.mjs" \
  --hardcoded tmp/i18n-hardcoded-cjk.json \
  --output tmp/i18n-hardcoded-fix-tasks \
  --ignore src/modules/demo
```

Use this only when the task includes finding hardcoded Chinese/CJK text or when a broad migration asks for it. The scan is a triage tool, not a parser. Treat `raw-jsx-text` and `ui-prop-string` as the highest-priority candidates. Probable `.d(defaultMessage)` source text is hidden by default because the default locale should remain in source for extraction.
When fixing a candidate, preserve the complete user-facing business meaning rather than extracting only the visible CJK fragment. If surrounding code supplies the subject, count, object, status, or action, move those values into the same ICU message so translated locales can use natural word order and phrasing.

## Handoff

```bash
node "$SKILL_DIR/scripts/create-i18n-handoff.mjs" \
  --discovery tmp/i18n-discovery.json \
  --export-verify tmp/i18n-export-verify.json \
  --audit tmp/i18n-audit.json \
  --hardcoded tmp/i18n-hardcoded-cjk.json \
  --audit-fix-tasks tmp/i18n-audit-fix-tasks/manifest.json \
  --length-review-tasks tmp/i18n-length-review-tasks/manifest.json \
  --hardcoded-fix-tasks tmp/i18n-hardcoded-fix-tasks/manifest.json \
  --tasks tmp/i18n-translation-tasks/manifest.json \
  --delta-review tmp/i18n-delta-review.json \
  --translation-review-tasks tmp/i18n-translation-review-tasks/manifest.json \
  --apply tmp/i18n-apply-result.json \
  --changed-key-audit tmp/i18n-changed-key-audit.json \
  --output tmp/i18n-handoff.md
```

Use the handoff report before claiming the i18n work is complete. For normal incremental work, focus the handoff on changed-key evidence: default-locale diff task manifest, delta review, delta merge, changed-key audit, translation review status, static UI-fit review status, and unresolved review items. Full audit and hardcoded evidence should be included only when those scripts were relevant to the task. When changed-key audit evidence is present, a missing full locale audit is not treated as a default blocker. Browser Use is not part of this daily handoff evidence unless the user explicitly requested UI Inspection Mode or a release/preflight quality gate. The static handoff can say no length warnings were found, but must not imply that text overflow/truncation, layout overflow, alignment, or component visual integrity were verified in a browser.

The handoff can also make broader blockers explicit, including audit hard errors, export failures, skipped delta entries, generated fix/review task coverage, high-priority hardcoded CJK candidates, translation quality review tasks, translation length review tasks, and unresolved runtime locale recommendations from discovery/export reports. The Locale Audit section reports source `intl.get(...).d(...)` contract entries, while discovery/export locale summaries report locale JSON key counts. When hardcoded fix tasks provide ignore patterns, the handoff keeps the raw scan count but reports actionable hardcoded candidates after those ignores, so the top examples match the generated fix queue.

The handoff also includes `Recommended Next Actions`. Follow that order when continuing a large i18n task: fix export/audit blockers before merge, then handle delta review, quality review, and apply. Handoff checks whether discovery/export report locale counts still match the current locale files; if counts differ, regenerate discovery/export verification before trusting downstream counts.

## Self Test

```bash
node "$SKILL_DIR/scripts/self-test.mjs"
```

Use this after editing helper scripts. It creates a temporary fixture and verifies the minimal chain for discovery, export verification, translation task instructions, delta validation, translation quality review tasks, delta merge validation, changed-key audit, contract audit, audit summaries, audit fix tasks, hardcoded CJK fix tasks, and handoff blockers. Pass `--keep` only when debugging the generated fixture.
