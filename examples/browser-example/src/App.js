import intl from "react-intl-universal"
import _ from "lodash";
import http from "axios";
import React, { Component } from "react";
import PluralComponent from "./Plural";
import BasicComponent from "./Basic";
import HtmlComponent from "./Html";
import DateComponent from "./Date";
import CurrencyComponent from "./Currency";
import MessageNotInComponent from "./MessageNotInComponent";
import FallbackComponent from "./Fallback";
import "./app.css";

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
    name: "日本の",
    value: "ja-JP"
  }
];

class App extends Component {
  state = { initDone: false };

  constructor(props) {
    super(props);
    this.onSelectLocale = this.onSelectLocale.bind(this);
  }

  componentDidMount() {
    this.loadLocales();
  }

  render() {
    return (
      this.state.initDone &&
      <div>
        {this.renderLocaleSelector()}
        <BasicComponent />
        <PluralComponent />
        <HtmlComponent />
        <DateComponent />
        <CurrencyComponent />
        <MessageNotInComponent />
        <FallbackComponent />
      </div>
    );
  }

  loadLocales() {
    let currentLocale = intl.determineLocale({
      urlLocaleKey: "lang",
      cookieLocaleKey: "lang"
    });
    if (!_.find(SUPPOER_LOCALES, { value: currentLocale })) {
      currentLocale = "en-US";
    }

    let fallbackLocales = currentLocale === 'zh-TW' ? ['zh-CN', 'en-US'] : ['en-US'];
   
    let allLocales = [currentLocale, ...fallbackLocales];

    function getMessagesByLocale(locale) {
      return http.get(`locales/${locale}.json`);
    }

    let promises = allLocales.map(item => getMessagesByLocale(item));

    http
      .all(promises)
      .then(http.spread((...results) => {
        // init method will load CLDR locale data according to currentLocale
        let locales = {}
        for (let i=0; i<allLocales.length; i++) {
          Object.assign(locales, {
            [allLocales[i]]: results[i].data
          })
        }

        return intl.init({
          currentLocale,
          fallbackLocales,
          locales
        })
      }))
      .then(() => {
        // After loading CLDR locale data, start to render
        this.setState({ initDone: true });
      });
  }

  renderLocaleSelector() {
    return (
      <select onChange={this.onSelectLocale} defaultValue="">
        <option value="" disabled>Change Language</option>
        {SUPPOER_LOCALES.map(locale => (
          <option key={locale.value} value={locale.value}>{locale.name}</option>
        ))}
      </select>
    );
  }

  onSelectLocale(e) {
    let lang = e.target.value;
    location.search = `?lang=${lang}`;
  }
}

export default App;
