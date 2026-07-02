# Message Patterns

Open this reference when writing, reviewing, or migrating concrete `react-intl-universal` calls.

## Table of Contents

- [Plain Strings](#plain-strings)
- [Dynamic Fragments](#dynamic-fragments)
- [Rich React Components](#rich-react-components)
- [Plural Messages](#plural-messages)
- [Date and Time Formatting](#date-and-time-formatting)
- [Number Formatting](#number-formatting)
- [getHTML](#gethtml)
- [React vs Non-React Code](#react-vs-non-react-code)
- [TypeScript](#typescript)

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
Do not use template strings for user-facing `.d()` messages. Use ICU placeholders such as `{username}` instead.

## Dynamic Fragments

When hardcoded text appears next to dynamic text, avoid extracting only the visible CJK fragment.
Move the neighboring dynamic values into one ICU message so each locale can choose natural order and wording.

Prefer this:

```tsx
const foldedNames = intl
  .get("WORKSPACE_FOLDED_NAMES", { names: firstThreeNames, count: projectIds.length })
  .d("{names} ...等{count}个");

<ExTooltip trigger={<span>{foldedNames}</span>}>{allNames}</ExTooltip>
```

Locale pack:

```json
{
  "WORKSPACE_FOLDED_NAMES": "{names} ...{count} total"
}
```

Avoid this because only the Chinese suffix is translatable and other locales cannot reorder the phrase:

```tsx
<>
  {firstThreeNames}
  <span> ...等{projectIds.length}个</span>
</>
```

## Rich React Components

Only use this pattern with [react-intl-universal](https://www.npmjs.com/package/react-intl-universal)@2.14+.

Use `intl.get` with ICU variables and rich tag formatter values in the same translated sentence:

```tsx
const username = "Tony";
const docsUrl = "/docs";

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

## Plural Messages

Use ICU `plural` rules when the visible copy depends on a count.
The `#` placeholder formats the count with the active locale, including locale-aware grouping for large numbers.

```tsx
intl
  .get("PHOTO_COUNT", { photoNum })
  .d("You have {photoNum, plural, =0 {no photos} =1 {one photo} other {# photos}}.")
```

Locale pack:

```json
{
  "PHOTO_COUNT": "You have {photoNum, plural, =0 {no photos} =1 {one photo} other {# photos}}."
}
```

Keep all plural branches in one message so each locale can choose natural grammar.

## Date and Time Formatting

Use `intl.formatDate`, `intl.formatTime`, or `intl.formatDateTime` before passing date/time values into `intl.get`.
Default formats:

- `intl.formatDate(date)` returns `YYYY-MM-DD`.
- `intl.formatTime(date)` returns `HH:mm:ss`.
- `intl.formatDateTime(date)` returns `YYYY-MM-DD HH:mm:ss`.

Keep locale messages as normal ICU placeholder messages after formatting.

```tsx
intl
  .get("SALE_START", { start: intl.formatDate(start) })
  .d("Sale begins {start}")

intl
  .get("SALE_END", { end: intl.formatDateTime(end) })
  .d("Sale ends {end}")

intl
  .get("COUPON_EXPIRES", { expires: intl.formatTime(expires) })
  .d("Coupon expires at {expires}")
```

Locale pack:

```json
{
  "SALE_START": "Sale begins {start}",
  "SALE_END": "Sale ends {end}",
  "COUPON_EXPIRES": "Coupon expires at {expires}"
}
```

Avoid this pattern for new code when the intent is to use the stable helpers:

```tsx
intl
  .get("SALE_START", { start })
  .d("Sale begins {start, date, long}")
```

## Number Formatting

Use `intl.formatNumber` before passing plain numbers into `intl.get`.
Keep locale messages as simple placeholder messages after formatting.

```tsx
intl
  .get("VIEW_COUNT", { count: intl.formatNumber(viewCount) })
  .d("{count} views")
```

Locale pack:

```json
{
  "VIEW_COUNT": "{count} views"
}
```

`react-intl-universal` does not provide a dedicated `formatCurrency` helper. If product currency formatting is required, use the project's approved money formatter first, then pass the formatted value into `intl.get`.

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
