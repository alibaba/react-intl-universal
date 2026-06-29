---
name: use-react-intl-universal
description: Best-practice guidance for using react-intl-universal in React, TypeScript, Node, and shared frontend code. Use when writing, reviewing, migrating, or documenting i18n code that calls intl.get, intl.getHTML, intl.init, .d(defaultMessage), rich tag formatters, ICU variables, plural/select messages, or locale-pack keys.
---

# React Intl Universal

Use this skill when implementing or reviewing code that uses `react-intl-universal`.
Prefer patterns that keep translations grammatical, extractable, type-safe, and compatible across React and non-React code.

## Prerequisite

Rich React component interpolation with `intl.get` requires [react-intl-universal](https://www.npmjs.com/package/react-intl-universal)@2.14.0 or later.

## Core Rules

- Use `intl.get(key, values).d(defaultMessage)` as the default API for application text.
- Treat `.d(defaultMessage)` as the default locale message, not as an already-rendered fallback string.
- Write `.d()` messages with ICU placeholders such as `{username}`, `{count}`, and plural/select syntax.
- Keep a complete sentence in one message key. Do not split a sentence across several keys just to inject links, badges, or styled text.
- Keep locale-pack messages and `.d()` messages structurally equivalent: same ICU variables and same rich tags.
- Use simple, stable keys. Do not build keys dynamically unless the surrounding code already has a strict convention for doing so.
- In TypeScript, let primitive-value calls infer `string`; use rich tag formatter values only when the rendered result may contain React nodes.

## Plain Strings

Prefer this:

```tsx
<div>
  {intl.get("HELLO_USER", { username: "Tony" }).d("Hello, {username}!")}
</div>
```

Avoid this when the text is intended to be translated or extracted:

```tsx
<div>
  {intl.get("HELLO_USER", { username: "Tony" }).d(`Hello, ${username}!`)}
</div>
```

The template-string form is evaluated by JavaScript before `react-intl-universal` sees it, so it is not a real default message with ICU variables.
Only use a template string in `.d()` when the dynamic string is intentionally not part of the translation contract.

## Rich React Components

Only use this pattern with [react-intl-universal](https://www.npmjs.com/package/react-intl-universal)@2.14+.

Use `intl.get` with ICU variables and rich tag formatter values in the same translated sentence:

```tsx
const username = "Tony";
const docsUrl = "https://alibaba.github.io/react-intl-universal";

intl
  .get("READ_USER_DOCS", {
    username,
    link: (chunks) => (
      <a href={docsUrl} target="_blank" rel="noreferrer">
        {chunks}
      </a>
    ),
  })
  .d("Hello, {username}. Read the <link>documentation</link>.")
```

Locale pack:

```json
{
  "READ_USER_DOCS": "Hello, {username}. Read the <link>documentation</link>."
}
```

Guidelines:

- Use `{variable}` for plain ICU values and `<tag>...</tag>` for rich React components.
- Keep component props such as `href`, `onClick`, `tone`, and `className` in code; keep only translatable text and tag placement in messages.
- Use rich tags such as `<link>...</link>`, `<badge>...</badge>`, and `<strong>...</strong>` in messages.
- Pass a formatter function with the same name as each rich tag.
- Treat `chunks` as the translated children inside that tag. It is usually a `ReactNode[]`, not a plain string.
- Render `chunks` as children of the component unless there is a specific reason to transform them.
- If a formatter returns multiple sibling elements, provide stable React keys.
- Do not pass ordinary React elements through plain ICU placeholders such as `{icon}` as the public contract. Wrap translatable content in rich tags instead.

## getHTML

`intl.getHTML` is deprecated. Do not add new `intl.getHTML` usage for React UI.
Prefer `intl.get` as the unified API for plain strings, HTML-like text, and rich React component interpolation.

Use `getHTML` only when maintaining legacy code that already expects an HTML string:

```tsx
const legacyHtml = intl.getHTML("LEGACY_HTML").d("<b>Legacy</b> message");
```

When migrating `getHTML`, replace string concatenation and split messages with one rich `intl.get` message:

```tsx
intl
  .get("TERMS_NOTICE", {
    terms: (chunks) => <a href="/terms">{chunks}</a>,
  })
  .d("Please read the <terms>terms</terms> before continuing.")
```

## React vs Non-React Code

In shared utilities, validation messages, logs, SEO helpers, or Node code, use primitive values only:

```ts
export function getLimitMessage(limit: number) {
  return intl.get("LIMIT_MESSAGE", { limit }).d("The limit is {limit}.");
}
```

Use rich tag formatters only in React rendering paths, where returning React nodes is expected.

## TypeScript

Use the library's exported rich formatter types when a formatter is reused or when contextual typing is unclear:

```tsx
import type { ReactIntlUniversalRichTagFormatter } from "react-intl-universal";

const strong: ReactIntlUniversalRichTagFormatter = (chunks) => (
  <strong>{chunks}</strong>
);
```

Expected typing behavior:

- Primitive values should infer `string`.
- Rich tag formatter values should infer `string | ReactNode[]`-style rendered output according to the installed library version.
- If `chunks` becomes implicit `any`, check that the project is using a version whose generated declarations include rich formatter overloads, then refresh generated declaration files or reinstall dependencies.

## Validation Checklist

Before finishing changes:

- Verify `.d()` uses ICU placeholders instead of JavaScript interpolation for translatable values.
- Verify no new `getHTML` usage was introduced for React UI.
- Verify rich formatter examples render the translated `chunks`.
