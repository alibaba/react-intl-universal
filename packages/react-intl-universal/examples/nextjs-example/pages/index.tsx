import React from 'react';
import intl from 'core/intl';
import useForceUpdate from 'use-force-update';
import enUS from 'locales/en-US.json';
import zhCN from 'locales/zh-CN.json';
import zhTW from 'locales/zh-TW.json';
import frFr from 'locales/fr-FR.json';
import jaJP from 'locales/ja-JP.json';

import BasicComponent from 'components/basic';
import PluralComponent from "components/plural";
import HtmlComponent from "components/html";
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
    label: "日本語",
    value: "ja-JP"
  }
];

const LOCALE_DATA = {
  "en-US": enUS,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  "fr-FR": frFr,
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

  return (
    <div>
      {initDone && (
        <div className="react-intl-universal-example">
          <header className="example-header">
            <div className="example-header-inner">
              {localeSelector}
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
          </header>

          <main className="example-content">
            <BasicComponent />
            <HtmlComponent />
            <MessageNotInComponent />
            <PluralComponent />
            <DateComponent />
            <CurrencyComponent />
          </main>
        </div>
      )}
    </div>
  );
}

export default ReactIntlUniversalExample;
