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

  React.useEffect(() => {
    initializeIntl();
  }, []);

  const initializeIntl = () => {
    // 1. Get the currentLocale from url, cookie, or browser setting
    let currentLocale = intl.determineLocale({
      urlLocaleKey: 'lang', // Example: https://fe-tool.com/react-intl-universal?lang=en-US
      cookieLocaleKey: 'lang', // Example: "lang=en-US" in cookie
    });

    // 2. Fallback to "en-US" if the currentLocale isn't supported in LOCALES_LIST
    if (!LOCALES_LIST.some(item => item.value === currentLocale)) {
      currentLocale = "en-US"
    }

    // 3. Set currentLocale and load locale data 
    setCurrentLocale(currentLocale);

    // 4. After loading locale data, start to render
    setInitDone(true);
  }

  const setCurrentLocale = (currentLocale: string) => {
    intl.init({
      // debug: true,
      currentLocale,
      locales: LOCALE_DATA,
    });
  };

  const onLocaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentLocale(e.target.value);
    forceUpdate();
  }

  const localeSelector = (
    <select onChange={onLocaleChange} defaultValue="">
      <option value="" disabled>Change Language</option>
      {LOCALES_LIST.map(locale => (
        <option key={locale.value} value={locale.value}>{locale.label}</option>
      ))}
    </select>
  );

  return (
    <div>
      {initDone && (
        <div className="react-intl-universal-example">
          {localeSelector}
          <BasicComponent />
          <PluralComponent />
          <HtmlComponent />
          <DateComponent />
          <CurrencyComponent />
          <MessageNotInComponent />
        </div>
      )}
    </div>
  );
}

export default ReactIntlUniversalExample;
