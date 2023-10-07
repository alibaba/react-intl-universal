import "intl";
import React from "react";
import IntlMessageFormat from "intl-messageformat";
import escapeHtml from "escape-html";
import cookie from "cookie";
import queryParser from "querystring";
import invariant from "invariant";
import * as constants from "./constants";
import merge from "lodash.merge";

String.prototype.defaultMessage = String.prototype.d = function (msg) {
  return this || msg || "";
};

class ReactIntlUniversal {
  constructor() {
    this.options = {
      currentLocale: null, // Current locale such as 'en-US'
      locales: {}, // app locale data like {"en-US":{"key1":"value1"},"zh-CN":{"key1":"值1"}}
      warningHandler: function warn(...msg) { console.warn(...msg) }, // ability to accumulate missing messages using third party services
      escapeHtml: true, // disable escape html in variable mode
      // commonLocaleDataUrls: COMMON_LOCALE_DATA_URLS,
      fallbackLocale: null, // Locale to use if a key is not found in the current locale
    };
  }

  /**
   * Get the formatted message by key
   * @param {string} key The string representing key in locale data file
   * @param {Object} variables Variables in message
   * @returns {string} message
   */
  get(key, variables) {
    if (this.options.intlGetHook) {
      try {
        this.options.intlGetHook(key, this.options.currentLocale);
      } catch (e) {
        console.log('intl get hook error: ', e);
      }
    }
    invariant(key, "key is required");
    const { locales, currentLocale, formats } = this.options;

    if (!locales || !locales[currentLocale]) {
      this.options.warningHandler(
        `react-intl-universal locales data "${currentLocale}" not exists.`
      );
      return "";
    }
    let msg = this.getDescendantProp(locales[currentLocale], key);
    if (msg == null) {
      if (this.options.fallbackLocale) {
        msg = this.getDescendantProp(locales[this.options.fallbackLocale], key);
        if (msg == null) {
          this.options.warningHandler(
            `react-intl-universal key "${key}" not defined in ${currentLocale} or the fallback locale, ${this.options.fallbackLocale}`
          );
          return "";
        }
      } else {
        this.options.warningHandler(
          `react-intl-universal key "${key}" not defined in ${currentLocale}`
        );
        return "";
      }
    }
    if (variables) {
      variables = Object.assign({}, variables);
      // HTML message with variables. Escape it to avoid XSS attack.
      for (let i in variables) {
        let value = variables[i];
        if (
          this.options.escapeHtml === true &&
          (typeof value === "string" || value instanceof String) &&
          value.indexOf("<") >= 0 &&
          value.indexOf(">") >= 0
        ) {
          value = escapeHtml(value);
        }
        variables[i] = value;
      }
    } else {
      return msg;
    }

    try {
      const cacheKey = key + JSON.stringify(variables) + currentLocale;
      let computedValue = this.cache[cacheKey];
      if (typeof computedValue === 'undefined') {
        const msgFormatter = new IntlMessageFormat(msg, currentLocale, formats);
        computedValue = msgFormatter.format(variables);
        this.cache[cacheKey] = computedValue;
      }
      return computedValue;
    } catch (err) {
      this.options.warningHandler(
        `react-intl-universal format message failed for key='${key}'.`,
        err.message
      );
      return msg;
    }
  }

  /**
   * Get the formatted html message by key.
   * @param {string} key The string representing key in locale data file
   * @param {Object} variables Variables in message
   * @returns {React.Element} message
  */
  getHTML(key, variables) {
    if (this.options.intlGetHook) {
      try {
        this.options.intlGetHook(key, this.options.currentLocale);
      } catch (e) {
        console.log('intl get hook error: ', e);
      }
    }
    let msg = this.get(key, variables);
    if (msg) {
      const el = React.createElement("span", {
        dangerouslySetInnerHTML: {
          __html: msg
        }
      });
      // when key exists, it should still return element if there's defaultMessage() after getHTML()
      const defaultMessage = () => el;
      return Object.assign(
        { defaultMessage: defaultMessage, d: defaultMessage },
        el
      );
    }
    return "";
  }

  /**
   * As same as get(...) API
   * @param {Object} options
   * @param {string} options.id
   * @param {string} options.defaultMessage
   * @param {Object} variables Variables in message
   * @returns {string} message
  */
  formatMessage(messageDescriptor, variables) {
    const { id, defaultMessage } = messageDescriptor;
    return this.get(id, variables).defaultMessage(defaultMessage);
  }

  /**
   * As same as getHTML(...) API
   * @param {Object} options
   * @param {string} options.id
   * @param {React.Element} options.defaultMessage
   * @param {Object} variables Variables in message
   * @returns {React.Element} message
  */
  formatHTMLMessage(messageDescriptor, variables) {
    const { id, defaultMessage } = messageDescriptor;
    return this.getHTML(id, variables).defaultMessage(defaultMessage);
  }

  /**
   * Helper: determine user's locale via URL, cookie, localStorage, and browser's language.
   * You may not need this API, if you have other rules to determine user's locale.
   * @param {string} options.urlLocaleKey URL's query Key to determine locale. Example: if URL=http://localhost?lang=en-US, then set it 'lang'
   * @param {string} options.cookieLocaleKey Cookie's Key to determine locale. Example: if cookie=lang:en-US, then set it 'lang'
   * @param {string} options.localStorageLocaleKey LocalStorage's Key to determine locale such as 'lang'
   * @returns {string} determined locale such as 'en-US'
   */
  determineLocale(options = {}) {
    return (
      this.getLocaleFromURL(options) ||
      this.getLocaleFromCookie(options) ||
      this.getLocaleFromLocalStorage(options) ||
      this.getLocaleFromBrowser()
    );
  }

  /**
   * Initialize properties and load CLDR locale data according to currentLocale
   * @param {Object} options
   * @param {string} options.currentLocale Current locale such as 'en-US'
   * @param {string} options.locales App locale data like {"en-US":{"key1":"value1"},"zh-CN":{"key1":"值1"}}
   * @returns {Promise}
   */
  init(options = {}) {
    invariant(options.currentLocale, "options.currentLocale is required");
    invariant(options.locales, "options.locales is required");

    Object.assign(this.options, options);

    this.options.formats = Object.assign(
      {},
      this.options.formats,
      constants.defaultFormats
    );

    this.cache = Object.create(null)

    return new Promise((resolve, reject) => {
      // init() will not load external common locale data anymore.
      // But, it still return a Promise for abckward compatibility.
      resolve();
    });
  }

  /**
   * Get the inital options
   */
  getInitOptions() {
    return this.options;
  }

  /**
   * Load more locales after init
   */
  load(locales) {
    merge(this.options.locales, locales);
  }

  getLocaleFromCookie(options) {
    const { cookieLocaleKey } = options;
    if (cookieLocaleKey) {
      let params = cookie.parse(document.cookie);
      return params && params[cookieLocaleKey];
    }
  }

  getLocaleFromLocalStorage(options) {
    const { localStorageLocaleKey } = options;
    if (localStorageLocaleKey && window.localStorage) {
      return localStorage.getItem(localStorageLocaleKey);
    }
  }

  getLocaleFromURL(options) {
    const { urlLocaleKey } = options;
    if (urlLocaleKey) {
      let query = location.search.split("?");
      if (query.length >= 2) {
        let params = queryParser.parse(query[1]);
        return params && params[urlLocaleKey];
      }
    }
  }

  getDescendantProp(locale, key) {

    if (locale[key]) {
      return locale[key];
    }

    const msg = key.split(".").reduce(function (a, b) {
      return (a != undefined) ? a[b] : a;
    }, locale);

    return msg;
  }

  getLocaleFromBrowser() {
    return navigator.language || navigator.userLanguage;
  }
}

export default ReactIntlUniversal;
