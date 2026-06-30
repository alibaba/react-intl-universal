# Inspect Existing I18n Setup Before Editing

Before editing source or locale JSON, inspect the current project's i18n setup.
Do not assume a repository uses the generic `react-intl-universal-extract` CLI directly.
Many repositories wrap extraction with custom project commands, product locale enums, component-library locale adapters, and date-library setup.

## Project Background to Understand

- Where default messages come from: source `.d(defaultMessage)`, generated default locale JSON, or a project-specific extraction flow.
- Which locale is the default/source locale and which locale files already exist.
- Which command regenerates locale packs and whether it writes only the default locale or multiple locales.
- How runtime locale selection works: `intl.init`, dynamic imports, locale maps, route/app providers, or product locale enums.
- Which adjacent libraries also need runtime locale setup, such as component libraries, `moment`, or `dayjs`.

## Concrete Places to Check

- `package.json` scripts whose names or commands contain `intl`, `i18n`, `locale`, `extract`, or `translate`.
- Installed versions of `react-intl-universal`, extraction tools, component libraries, `moment`, and `dayjs`.
- Locale JSON location and current locale names.
- `intl.init`, dynamic locale imports, `getCurrentLocale`, product locale enum mappings, component `ConfigProvider`, `moment.locale`, and `dayjs.locale`.
- Whether dependencies are installed. If `node_modules` is missing, do not guess third-party locale availability; record the uncertainty and verify after install.
- Whether the actual extraction command can run at least `--help` or `--version`. Capture outdated-tool warnings separately from i18n contract failures.
- Whether extraction/export generated every expected locale file. Some project wrappers can exit with code 0 while logging generation failures, so inspect logs and output files/counts. If batch export misses locales, retry the missing locales individually before deciding whether the locale is unsupported.
- Prioritize connection points that actually own runtime locale behavior, such as `intl.init`, dynamic locale imports, locale maps, `ConfigProvider locale=...`, and date-library locale setup. Do not treat a file as needing locale setup just because it imports a provider symbol that is not used for locale behavior.

When checking third-party locale support, prefer static inspection of `.d.ts`, source files, package metadata, or official docs.

## Discovery Script

Use the discovery script when available:

```bash
export SKILL_DIR=/absolute/path/to/use-react-intl-universal
node "$SKILL_DIR/scripts/discover-project-i18n.mjs" \
  --source src \
  --locales src/locales \
  --expected-locales zh_CN,en_US,zh_TW
```

Set `SKILL_DIR` to the directory that contains `SKILL.md`. Use `--expected-locales` when checking extraction/export output for the locale set the repository is expected to support. It reports missing generated files directly instead of relying on manual comparison.
