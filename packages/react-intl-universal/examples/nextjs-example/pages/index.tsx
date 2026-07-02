import React from 'react';
import intl from 'core/intl';
import useForceUpdate from 'use-force-update';
import enUS from 'locales/en-US.json';
import zhCN from 'locales/zh-CN.json';
import zhTW from 'locales/zh-TW.json';
import frFr from 'locales/fr-FR.json';
import deDE from 'locales/de-DE.json';
import koKR from 'locales/ko-KR.json';
import jaJP from 'locales/ja-JP.json';

import BasicComponent from 'components/basic';
import PluralComponent from "components/plural";
import HtmlComponent from "components/html";
import SkillComponent from "components/skill";
import ExtractComponent from "components/extract";
import DateComponent from "components/date";
import CurrencyComponent from "components/currency";
import MessageNotInComponent from "components/message-not-in-component";

const LOCALES_LIST = [
  {
    label: "English",
    value: "en-US",
  },
  {
    label: "简体中文",
    value: "zh-CN",
  },
  {
    label: "繁體中文",
    value: "zh-TW"
  },
  {
    label: "français",
    value: "fr-FR"
  },
  {
    label: "Deutsch",
    value: "de-DE"
  },
  {
    label: "한국어",
    value: "ko-KR"
  },
  {
    label: "日本語",
    value: "ja-JP"
  }
];

const LOCALE_DATA = {
  "en-US": enUS,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  "fr-FR": frFr,
  "de-DE": deDE,
  "ko-KR": koKR,
  "ja-JP": jaJP,
}


const ReactIntlUniversalExample: React.FC<any> = (props) => {
  const forceUpdate = useForceUpdate();
  const [initDone, setInitDone] = React.useState(false);
  const [selectedLocale, setSelectedLocale] = React.useState("en-US");

  React.useEffect(() => {
    initializeIntl();
  }, []);

  const initializeIntl = () => {
    setCurrentLocale(selectedLocale);

    setInitDone(true);
  }

  const setCurrentLocale = (currentLocale: string) => {
    intl.init({
      // debug: true,
      currentLocale,
      locales: LOCALE_DATA,
    });
  };

  const onLocaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextSelectedLocale = e.target.value;
    setSelectedLocale(nextSelectedLocale);
    setCurrentLocale(nextSelectedLocale);
    forceUpdate();
  }

  const localeSelector = (
    <fieldset className="locale-selector" aria-label="Locale">
      {LOCALES_LIST.map(locale => (
        <label className="locale-option" key={locale.value}>
          <input
            type="radio"
            name="locale"
            value={locale.value}
            checked={selectedLocale === locale.value}
            onChange={onLocaleChange}
          />
          {locale.label}
        </label>
      ))}
    </fieldset>
  );

  const renderExampleContent = () => {
    const sectionNavItems = [
      {
        id: "skill-usage",
        label: intl.get("EXAMPLE_SECTION_SKILL").d("Agent Skill for Internationalization"),
      },
      {
        id: "intl-usage",
        label: intl.get("EXAMPLE_SECTION_INTL").d("Unified i18n with react-intl-universal"),
      },
      {
        id: "extract-usage",
        label: intl.get("EXAMPLE_SECTION_EXTRACT").d("Extract Defaults to Locale Files"),
      },
    ];
    const getSectionTitle = (index: number) => `${index + 1}. ${sectionNavItems[index].label}`;

    return (
      <div className="react-intl-universal-example">
        <header className="example-header">
          <div className="example-header-inner">
            {localeSelector}
            <div className="header-links">
              <a
                className="package-badge"
                href="https://npm-compare.com/react-intl-universal"
                target="_blank"
                rel="noreferrer"
              >
                <img
                  alt="react-intl-universal downloads"
                  src="https://img.shields.io/npm/dw/react-intl-universal.svg"
                />
              </a>
              <a
                className="package-badge"
                href="https://www.npmjs.com/package/react-intl-universal"
                target="_blank"
                rel="noreferrer"
              >
                <img
                  alt="react-intl-universal version"
                  src="https://img.shields.io/npm/v/react-intl-universal.svg"
                />
              </a>
              <a
                className="package-link"
                href="https://github.com/alibaba/react-intl-universal/"
                target="_blank"
                rel="noreferrer"
              >
                <svg className="github-logo" viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
                  />
                </svg>
                alibaba/react-intl-universal
              </a>
            </div>
          </div>
        </header>

        <div className="example-layout">
          <main className="example-main">
            <section className="example-section" id="skill-usage">
              <h2 className="section-title">{getSectionTitle(0)}</h2>
              <SkillComponent />
            </section>

            <section className="example-section" id="intl-usage">
              <h2 className="section-title">{getSectionTitle(1)}</h2>
              <BasicComponent />
              <HtmlComponent />
              <MessageNotInComponent />
              <PluralComponent />
              <DateComponent />
              <CurrencyComponent />
            </section>

            <section className="example-section" id="extract-usage">
              <h2 className="section-title">{getSectionTitle(2)}</h2>
              <ExtractComponent />
            </section>
          </main>

          <nav className="example-toc" aria-label="Example sections">
            <div className="example-toc-title">{intl.get("EXAMPLE_TOC_TITLE").d("Contents")}</div>
            {sectionNavItems.map((item, index) => (
              <a className="example-toc-link" href={`#${item.id}`} key={item.id}>
                {getSectionTitle(index)}
              </a>
            ))}
          </nav>
        </div>
      </div>
    );
  };

  return (
    <div>
      {initDone && renderExampleContent()}
    </div>
  );
}

export default ReactIntlUniversalExample;
