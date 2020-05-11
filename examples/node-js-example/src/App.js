import intl from 'react-intl-universal';
import React, { Component } from "react";
import BasicComponent from "./Basic";
import PluralComponent from "./Plural";
import HtmlComponent from "./Html";
import DateComponent from "./Date";
import CurrencyComponent from "./Currency";
import MessageNotInComponent from "./MessageNotInComponent";
import IntlPolyfill from "intl";

// For Node.js, common locales should be added in the application
global.Intl = IntlPolyfill;
require('intl/locale-data/jsonp/en.js');
require('intl/locale-data/jsonp/zh.js');
require('intl/locale-data/jsonp/fr.js');
require('intl/locale-data/jsonp/ja.js');

const SUPPOER_LOCALES = [
  {
    name: "English",
    value: "en-US"
  },
  {
    name: "简体中文",
    value: "zh-CN"
  },
  {
    name: "繁體中文",
    value: "zh-TW"
  },
  {
    name: "français",
    value: "fr-FR"
  },
  {
    name: "日本語",
    value: "ja-JP"
  }
];


class App extends Component {

  constructor(props) {
    super(props);
    const currentLocale = SUPPOER_LOCALES[0].value; // Determine user's locale here
    intl.init({
      currentLocale,
      locales: {
        [currentLocale]: require(`./locales/${currentLocale}`)
      }
    });
  }

  render() {
    return (
      <div>
        <BasicComponent />
        <PluralComponent />
        <HtmlComponent />
        <DateComponent />
        <CurrencyComponent />
        <MessageNotInComponent />
      </div>
    );
  }
}

export default App;
