# Translation Rules

Use these rules when generating, reviewing, or merging non-default locale text.

## Contract Rules

- Preserve every `{variable}` and `<tag>` exactly. Translation text may change; the message contract must not.
- Treat the default message as the source of product intent, not as a sentence template to preserve. Native target-locale wording, local word order, and concise UI phrasing are preferred when they express the same intent more naturally.
- Use existing non-target locale translations as terminology and tone references when task files provide them, but keep the default message as the source of truth for variables, rich tags, and current product meaning.
- When using subagents for translation, ask each subagent to return delta JSON only. The main agent should merge files and run audit.

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
- Long-form text is usually lower risk. For paragraphs, FAQ text, docs notes, help text, descriptions, and explanatory content, prefer natural and accurate translation over artificial shortening.
- When compact UI is high risk, first try a shorter non-default translation only if it preserves business meaning, naturalness, and terminology consistency.
- If accurate wording cannot be shortened safely, keep the accurate translation and consider a general layout fix such as wrapping, flexible width, or responsive layout.
- Use language-specific CSS only as a last option when a general layout fix is too costly, breaks the default-locale visual design, or creates broader layout risk.
- If static review is uncertain, record a UI-fit review item with key, locale, source usage, width comparison, and the reason for uncertainty. Do not enter UI Inspection Mode unless the user asks, provides a page URL for QA, or the task is a release/preflight quality gate.

## English Target Locale Rules

Use these rules only when the target locale is English:

- Use Sentence case for sentences, descriptions, validation messages, placeholders, tooltips, empty states, and most inline UI copy.
- Use Title Case for page titles, modal titles, section/card titles, and other title-like UI when the surrounding product UI uses title style. Capitalize major words; keep `a`, `an`, `the`, coordinating conjunctions, and prepositions of four letters or fewer lowercase unless they are the first or last word.
- Preserve product names, feature names, brand terms, acronyms, countries, languages, weekdays, months, and the pronoun `I` in their proper casing.
- Avoid all-caps except for established acronyms such as `API`, `SQL`, product-defined labels, `OK`, or an explicit design-system convention.

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
