# Translation Rules

Use these rules when generating, reviewing, or merging non-default locale text.

## Contract Rules

- Preserve every `{variable}` and `<tag>` exactly. Translation text may change; the message contract must not.
- Treat the default message as the source of product intent, not as a sentence template to preserve. Native target-locale wording, local word order, and concise UI phrasing are preferred when they express the same intent more naturally.
- Use existing non-target locale translations as terminology and tone references when task files provide them, but keep the default message as the source of truth for variables, rich tags, and current product meaning.
- When using subagents for translation, ask each subagent to return delta JSON only. The coordinator should merge files and run audit.

## Meaning-First Localization

- When translating between any source and target locale, do not translate word by word. Use nearby code and UI context to express the same product intent naturally in the target language, even when the target wording needs different word order, phrasing, or sentence structure.
- Before translating, identify the user action, subject, object, status, and surrounding workflow so the result reads like real product copy.
- Understand the current codebase's business context before choosing words. Use the module, route, component, surrounding UI, data model, and validation logic to infer what the text means in the product, then localize that meaning naturally.
- Prefer sense-for-sense localization. The target copy does not need to mirror the source sentence structure when a native product writer would phrase the same product intent differently.
- Translate what the user should understand in the actual feature, not dictionary equivalents of the source words. If a literal translation sounds stiff or unnatural, rewrite it into normal target-locale product wording while preserving the same product intent.
- Use the key, source file path, component name, route/module name, adjacent labels, enum names, table columns, validation logic, and business domain to choose natural wording in the target language.
- Before translating an ambiguous batch, inspect enough surrounding source to understand the product area, object names, status meanings, and user workflow. Do not rely on locale JSON keys alone.
- Avoid stiff literal translations. Do not force the source language's word order, sentence shape, or punctuation into the target language. Rewrite naturally when that is how a native product writer would express the same meaning.
- If the business meaning is unclear, inspect the source module or record the uncertainty; do not guess from the words alone.
- Preserve product names, technical terms, brand terms, acronyms, and domain terms when the target locale commonly keeps them unchanged. Translate them only when the project already has a clear localized convention.

## UI Length and Layout

- Do not modify the default locale message for length reasons.
- Daily development uses static UI-fit review, not Browser Use by default. Use estimated display width from `scripts/lib/display-width.mjs`, not `string.length`, as the lightweight signal.
- If the non-default translation estimated display width is less than or equal to the default message width, treat it as low risk for daily development. This is not a browser layout guarantee.
- If the non-default translation is wider than the default message, inspect the source usage before changing text. Review the key, source line, surrounding JSX, component props, `className`, CSS, layout container, and neighboring labels.
- Compact UI needs closer review: placeholders, buttons, tabs, menus, table headers, badges, chips, filters, dialog titles, sidebars, breadcrumbs, labels, status text, and card titles. These examples are risk hints, not hard rules; decide from the actual source context and layout.
- Static UI-fit review must also look for component visual-integrity risks, not only text length. DOM-safe text can still break a control visually when a grouped compact component wraps.
- Treat grouped controls as higher risk when source/CSS context suggests `display:flex` or `inline-flex`, `flex-wrap: wrap`, child buttons/tabs/chips, `border-right: 0` or similar collapsed borders, `:first-child`/`:last-child` border-radius rules, fixed/min widths, or `white-space: nowrap`. Mark this as a wrapped grouped-control visual integrity risk and inspect screenshots or record a review item.
- For tabs, segmented controls, button groups, filter groups, chip groups, badges, pagination, and table action groups, check whether wrapping keeps the component visually whole: borders remain continuous, radius appears only on the outer boundary, active/selected state stays clear, icons/text/arrows remain associated, and same-group items are not split into isolated controls.
- Long-form text is usually lower risk. For paragraphs, FAQ text, docs notes, help text, descriptions, and explanatory content, prefer natural and accurate translation over artificial shortening.
- When compact UI is high risk, first try a shorter non-default translation only if it preserves business meaning, naturalness, and terminology consistency.
- If accurate wording cannot be shortened safely, keep the accurate translation and consider a general layout fix. For grouped controls, prefer preventing free wrapping inside the visual group, using an explicit grid layout, allowing the whole group to move to a new row, switching to a vertical segmented-control style with correct per-position borders/radius, increasing container width, or replacing the group with a select/dropdown when space is constrained.
- Keep layout changes as small and local as possible. A small component-level width, spacing, or wrapping adjustment can be low risk when it does not alter shared layout behavior or unaffected locales.
- Treat broad page layout, shared table column allocation, responsive grid, fixed/locked column, default-locale visual changes, or locale-scoped broad layout branches as high-risk fixes that need human review, even when they solve the target-locale issue.
- If a broad layout change is truly required, first identify the language or locale where the issue occurs and scope the broad change to that problem language instead of changing unaffected languages.
- Use language-specific CSS only when needed to avoid breaking unaffected languages or the default-locale layout, and keep that branch as narrow as possible.
- If a layout fix needs runtime locale branching, first search for and reuse the current repository's locale helper, such as `isEn()`, `isEnglish()`, `getLang()`, a `LOCALE.EN_US` enum, or a project-specific locale store. Use a local one-off check such as `intl?.getInitOptions?.()?.currentLocale?.includes?.('en')` only when no existing helper or enum is available, and keep that fallback scoped to the smallest affected component.
- If static review is uncertain, record a UI-fit review item with key, locale, source usage, width comparison, and the reason for uncertainty. Do not enter UI Inspection Mode unless the user asks, provides a page URL for QA, or the task is a release/preflight quality gate.

## English Target Locale Rules

Use these rules only when the target locale is English:

### English Casing

Use three casing styles deliberately:

- `Sentence case`: capitalize the first word and proper nouns only.
- `Title Case`: capitalize major words in title-like UI.
- `All-caps`: capitalize every letter only for established acronyms, approved labels, or explicit design-system conventions.

Default to the casing pattern used by the surrounding product UI. If local context is ambiguous, prefer Sentence case for ordinary UI copy and Title Case for true titles.

Use Sentence case for:

- sentences, descriptions, help text, validation messages, tooltips, empty states, placeholders, table-cell copy, and most inline UI copy;
- button and action labels when the surrounding design system uses sentence-style buttons;
- direct quotes according to normal English grammar: capitalize the first word of a quoted full sentence, but do not force unrelated surrounding words into title case.

Use Title Case for page titles, modal titles, section titles, card titles, tab titles, and other title-like UI when the surrounding product UI uses title style.

Title Case rules:

- Capitalize major words: nouns, verbs including `is` and `be`, adjectives, adverbs, and pronouns.
- Keep articles `a`, `an`, and `the` lowercase unless they are the first or last word.
- Keep coordinating conjunctions `and`, `but`, `or`, `nor`, `yet`, and `so` lowercase unless they are the first or last word.
- Keep prepositions of four letters or fewer lowercase, such as `on`, `to`, `in`, `up`, `down`, `of`, and `for`, unless they are the first or last word.
- Preserve product-specific casing for product names, feature names, brand terms, UI labels, and domain terms even when they do not follow generic title rules.

Preserve proper casing for:

- product names, feature names, brand terms, and technical domain terms;
- person names, place names, countries, nationalities, and languages;
- weekdays and months. Seasons are usually lowercase unless part of a proper name;
- organizations and institutions;
- acronyms and initialisms such as `API`, `SQL`, `USA`, and `ECS`;
- the pronoun `I`, which is always uppercase.

Avoid all-caps except for established acronyms such as `API` or `SQL`, product-defined labels, `OK`, magazine/newspaper names or other proper names that are officially all-caps, or an explicit design-system convention. Do not use all-caps for emphasis in normal UI copy.

## Delta JSON Shape

Return translation deltas in this shape:

```json
{
  "locale": "de-DE",
  "translations": {
    "WELCOME_USER": "Willkommen, {username}!"
  }
}
```
