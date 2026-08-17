# use-react-intl-universal

[![skills.sh](https://www.skills.sh/b/alibaba/react-intl-universal)](https://www.skills.sh/alibaba/react-intl-universal/use-react-intl-universal)

`use-react-intl-universal` is an internationalization practice skill for projects using `react-intl-universal`. It guides message authoring, default message extraction, locale synchronization, translation review, and localized UI quality checks.

Common use cases:

- Add or update internationalized copy in React projects while keeping `.d(defaultMessage)`, the default locale file, and translated locale files consistent.
- Extract default messages with `react-intl-universal-extract` and generate translation tasks from changed keys instead of translating whole locale files.
- Check that ICU variables, rich text tags, dynamic values, and translations stay aligned to reduce runtime formatting or rendering risks.
- Inspect localized pages or screenshots for overly long text, truncation, overflow, misalignment, and related UI issues.
- Apply the same general i18n principles in non-`react-intl-universal` projects, such as keeping messages translatable, translations natural, and UI layouts stable.

Benefits:

- Keeps source messages, extracted defaults, and translated locale files easier to review and evolve.
- Reduces translation drift, missing placeholders, broken rich text tags, and unrelated locale file churn.
- Helps localized UI remain clear and usable across languages, especially in compact product surfaces.
- Gives agents and reviewers a repeatable workflow for safer i18n changes.
