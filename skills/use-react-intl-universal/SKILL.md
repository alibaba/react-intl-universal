---
name: use-react-intl-universal
description: Best-practice workflow for building and inspecting high-quality internationalized software with react-intl-universal, react-intl-universal-extract, and this skill's rules/scripts. Use it directly for repositories that use react-intl-universal, and use its language-quality, UI-quality, localized-UI inspection, and locale-synchronization principles as reference guidance for other i18n stacks.
---

# use-react-intl-universal

Use this skill as the recommended combined practice for repositories that use `react-intl-universal`: write messages with the library API, extract default messages with `react-intl-universal-extract`, and follow this skill's workflow, rules, and scripts to keep localized software high quality.

If a repository does not use `react-intl-universal`, still use the general principles in this skill as reference guidance for agents: preserve language quality, keep localized UI stable, avoid fragmented messages, preserve variable/tag contracts, and keep locale updates reviewable.

## Primary Goals

- Help users ship internationalized software that feels native, clear, and trustworthy in every supported locale.
- Maintain high language quality: preserve product intent, user actions, and business meaning through natural target-locale wording, while keeping terminology consistent across modules and workflows.
- Keep localized UI usable in real product layouts, with no text truncation, overflow, overlap, or misalignment, especially in compact controls, tables, forms, dialogs, validation messages, and navigation.
- Make localization changes predictable, reviewable, and safe to evolve over time.
- Reduce future localization cost by producing messages that are extractable, structurally consistent, and safe for translators or agents to update.

## Prerequisite

Rich React component interpolation with `intl.get` requires [react-intl-universal](https://www.npmjs.com/package/react-intl-universal)@2.14.0 or later.

## Main Scenarios

- Add a new business message key.
- Modify the default message for an existing key.
- Inspect a running localized UI from a user-provided page URL.
- Synchronize locale files that the project already supports.
- Keep `.d(defaultMessage)`, the default locale pack, and existing non-default locale packs consistent.

## Default Workflow

When adding or changing user-facing copy, start by inspecting the existing i18n setup. Open [Inspect Existing I18n Setup](references/inspect-existing-i18n-setup.md) for the detailed checks.

1. Discover the project's extraction command and current locale files.
2. Update the source `intl.get(key, values).d(defaultMessage)` first. Treat `.d(defaultMessage)` as the source default message that extraction tools should copy into the default locale.
3. Keep translatable dynamic values as ICU placeholders, such as `{username}`, not JavaScript template interpolation.
4. Keep React elements as rich tags, such as `<link>documentation</link>`, and keep component props in code.
5. Run the project extraction command to regenerate the default locale file.
6. Infer or confirm the default locale before editing translated locale files.
7. Generate translation tasks only from the default-locale diff. The diff is the source of added and changed keys.
8. Generate translation tasks only for existing non-default locale files unless the user explicitly asks to add a new locale.
9. Translate non-default locales from task files. Follow [Translation Rules](references/translation-rules.md). If the user provides glossary, style-guide, product-documentation, screenshot notes, page URLs, or other context assets, include them in the translation tasks. If using subagents, assign work by locale and cap parallel subagents at 5.
10. Review returned delta JSON before merging. Check:
    - every changed key is covered;
    - ICU `{variable}` contracts are preserved;
    - rich tag `<tag>` contracts are preserved;
    - non-default translations are not just copied from the default message unless that is intentional;
    - compact-UI translations are not risky because they are much longer than the default message;
    - translations are natural and match the product/business context.
11. Merge reviewed translation delta JSON files into locale JSON files.
12. Audit the changed keys after merge. Do not make a full-project audit the default completion condition.
13. Run [Validation Checklist](references/validation-checklist.md), then generate a handoff focused on changed-key synchronization status: added/changed keys, target locales, delta review, merge result, changed-key audit, and any remaining UI-length or naturalness review items.

Rerun the delta review whenever translation tasks are regenerated; older review reports can have outdated expected item counts.

Prefer the repository's existing extraction script, such as `npm run intl:extract`. If none exists, use:

```bash
npx react-intl-universal-extract \
  --cmd extract \
  --source-path ./src \
  --output-path ./src/locales/en-US.json
```

It is acceptable for the default locale file to be fully regenerated when the project treats `.d()` as the source of truth. Do not run extraction into non-default translated locale files.

Do not blindly machine-translate every locale file. Use the default-locale diff to translate only new or changed keys for locales that already exist in the project.

## UI Inspection Mode

When the user asks to start a UI inspection or provides a page URL for localization QA, open [UI Inspection Mode](references/ui-inspection-mode.md) and follow that workflow instead of the default source-editing workflow.

## Core Rules

1. Rule 1: Use `intl.get(key, values).d(defaultMessage)` as the source-of-truth text API.
   - Rule description: Treat `.d(defaultMessage)` as the default locale message. When user-facing copy changes, edit `.d(defaultMessage)` first, then regenerate the default locale pack from extraction.
   - Reason: One source of truth keeps source code, default locale JSON, and translated locale JSON from drifting apart.
   - Rule implementation: Use the repository extraction command or `react-intl-universal-extract`. If extraction is unavailable, install or configure the extraction tool before continuing; edit the default locale file manually only with explicit user approval. Run `verify-locale-export.mjs` after extraction when expected locale output matters.

2. Rule 2: Use ICU placeholders for translatable dynamic values.
   - Rule description: Write values as `{username}`, `{count}`, and plural/select syntax in `.d()` messages. Do not use JavaScript template interpolation for values that must be translated.
   - Reason: ICU placeholders let each locale reorder values naturally and keep the same behavior whether the message comes from `.d()` or a locale pack.
   - Rule implementation: `audit-i18n-contract.mjs` reports JavaScript template interpolation inside `.d()`. `review-translation-deltas.mjs`, `audit-changed-locale-keys.mjs`, and `audit-locale-key.mjs` verify placeholder consistency after locale updates.

3. Rule 3: Keep one user-facing sentence in one message key.
   - Rule description: Do not split a sentence across several keys just to inject links, badges, styled text, or dynamic values. When replacing hardcoded fragments near dynamic text, pull the surrounding dynamic values into the same ICU message.
   - Reason: Split messages prevent translators from changing word order, grammar, punctuation, and emphasis naturally.
   - Rule implementation: This is mainly a source-review rule. Use [Message Patterns](references/message-patterns.md) for examples; use `find-hardcoded-cjk.mjs` and `create-hardcoded-cjk-fix-tasks.mjs` when the task includes hardcoded CJK cleanup.

4. Rule 4: Use rich tags for React components and avoid new `getHTML` usage.
   - Rule description: Use rich tag formatters such as `<link>...</link>` for inline React elements. Keep component props in code and translatable text in the message. Do not add new `intl.getHTML` usage for React UI.
   - Reason: Rich tags preserve React component safety and let translators move the component placement inside the sentence.
   - Rule implementation: Open [Message Patterns](references/message-patterns.md) for rich formatter and TypeScript examples. `audit-i18n-contract.mjs` reports `intl.getHTML` usage so new or high-value cases can be migrated.

5. Rule 5: Preserve the render contract across `.d()` and locale packs.
   - Rule description: Target locales may rewrite and reorder text naturally, but every value for the same key must preserve the same `{variables}` and `<tags>`.
   - Reason: Missing variables or rich tags can break runtime formatting, React rendering, or translated sentence structure.
   - Rule implementation: Use `review-translation-deltas.mjs`, `apply-translation-deltas.mjs --default-locale`, `audit-changed-locale-keys.mjs`, `audit-locale-key.mjs`, and `audit-i18n-contract.mjs` to verify ICU variables and rich tags.

6. Rule 6: Use one stable literal key for one meaning.
   - Rule description: Use simple keys that can be extracted statically. Do not build keys dynamically unless the surrounding code already has a strict convention. When one key has multiple `.d()` defaults, first decide whether the meanings are truly the same; if they differ, search for existing sibling keys such as `_simple`, `_label`, `_title`, or `_tip` before creating a new key.
   - Reason: Dynamic keys and conflicting defaults make extraction, translation tasks, and contract audits unreliable.
   - Rule implementation: `audit-i18n-contract.mjs` reports conflicting `.d()` defaults for the same key. Dynamic key conventions require manual source review because static extraction cannot always prove the key set.

7. Rule 7: Synchronize translated locale files through changed-key tasks.
   - Rule description: After default-locale extraction, generate translation work only from the default-locale diff and only for locales the project already supports unless the user explicitly asks to add a new locale.
   - Reason: Translating whole locale files wastes work and increases the chance of unrelated wording churn.
   - Rule implementation: Use `create-translation-tasks.mjs --base-ref <ref>`, review results with `review-translation-deltas.mjs`, merge with `apply-translation-deltas.mjs`, then verify with `audit-changed-locale-keys.mjs`.

8. Rule 8: Translate by product meaning, with UI length in mind.
   - Rule description: Use source code, UI placement, route/module context, validation logic, and adjacent labels to write natural target-locale copy. Keep non-default translations concise in compact UI, but do not shorten the default locale just for layout reasons.
   - Reason: Literal translations and overly long UI labels create unnatural product copy and can break layout.
   - Rule implementation: Open [Translation Rules](references/translation-rules.md) before translating or reviewing non-default locale text. `create-translation-tasks.mjs` and `create-translation-review-tasks.mjs` include source context and review prompts. Use `review-translation-deltas.mjs` or `audit-i18n-contract.mjs --length-warnings` to surface translations that may need UI-context review.

## Skill Resources and Script Flow

- `references/message-patterns.md`: open when writing or reviewing concrete `react-intl-universal` code examples.
- `references/inspect-existing-i18n-setup.md`: open before editing an unfamiliar repository's source or locale JSON.
- `references/ui-inspection-mode.md`: open when the user asks for a page-level localized UI inspection from a URL.
- `references/ui-inspection-report-types.ts`: TypeScript contract for the machine-readable `report.json` written by UI inspection mode.
- `references/translation-rules.md`: open before translating or reviewing non-default locale text.
- `references/validation-checklist.md`: open before final handoff.
- `references/scripts.md`: open before running helper scripts so arguments, output files, and expected evidence are clear.
- `scripts/`: use when locale JSON files are available and deterministic discovery, translation, merge, audit, or handoff evidence is useful.

Recommended evidence flow:

1. `discover-project-i18n.mjs` before edits.
2. `verify-locale-export.mjs` after extraction/export.
3. `infer-default-locale.mjs` when the default locale is not obvious.
4. `create-translation-tasks.mjs --base-ref <ref>` for non-default locale work based on the default-locale diff. Add user-provided glossary or product-context files with `--context-file`.
5. `review-translation-deltas.mjs` before merging subagent or human translation results.
6. `create-translation-review-tasks.mjs` when delta warnings exist or when a deliberate naturalness/terminology review is useful.
7. `apply-translation-deltas.mjs` to merge reviewed translation results.
8. `audit-changed-locale-keys.mjs` after merge to verify only the changed keys.
9. `create-i18n-handoff.mjs` before reporting the task as done. For normal incremental work, keep the handoff focused on changed keys and translation sync status.

Use full-project scripts only when the user asks for broad cleanup/migration, when preparing a release gate, or when changed-key evidence points to wider debt:

- `audit-i18n-contract.mjs` for a full source/locale contract scan.
- `find-hardcoded-cjk.mjs` and `create-hardcoded-cjk-fix-tasks.mjs` for hardcoded CJK cleanup.
- `create-audit-fix-tasks.mjs` for large audit remediation queues.

When editing this skill's helper scripts, run `self-test.mjs` from the script reference before relying on real-project trials.

## Message Patterns

Open [Message Patterns](references/message-patterns.md) when writing or reviewing concrete code examples.
The reference covers plain ICU values, rich React component interpolation, `getHTML` migration, shared utility code, plural messages, date/time helpers, number formatting, and TypeScript rich formatter types.
