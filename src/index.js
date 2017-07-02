import IntlPolyfill from "intl";
import React from "react";
import IntlMessageFormat from "intl-messageformat";
import escapeHtml from "escape-html";
import cookie from "cookie";
import queryParser from "querystring";
import load from "load-script";
import invariant from "invariant";
import "console-polyfill";
import * as constants from "./constants";

const SYS_LOCALE_DATA_URL =
  "https://g.alicdn.com/alishu/common/0.0.86/locale-data";

let isPolyfill = false;
if (typeof window.Intl === "undefined") {
  window.Intl = IntlPolyfill;
  isPolyfill = true;
}

String.prototype.defaultMessage = String.prototype.d = function(msg) {
  return this || msg || "";
};

class ReactIntlUniversal {
  constructor() {
    this.options = {
      currentLocale: null, // Current locale such as 'en-US'
      urlLocaleKey: null, // URL's query Key to determine locale. Example: if URL=http://localhost?lang=en-US, then set it 'lang'
      cookieLocaleKey: null, // Cookie's Key to determine locale. Example: if cookie=lang:en-US, then set it 'lang'
      locales: {} // app locale data like {"en-US":{"key1":"value1"},"zh-CN":{"key1":"值1"}}
    };
  }

  /**
   * Get the formatted message by key
   * @param {string} key The string representing key in locale data file
   * @param {Object} variables Variables in message
   * @returns {string} message
   */
  get(key, variables) {
    invariant(key, "key is required");
    const { locales, currentLocale, formats } = this.options;

    if (!locales || !locales[currentLocale]) {
      return "";
    }
    let msg = locales[currentLocale][key];
    if (msg == null) {
      console.warn(
        `react-intl-universal key "${key}" not defined in ${currentLocale}`
      );
      return "";
    }
    if (variables) {
      variables = Object.assign({}, variables);
      // HTML message with variables. Escape it to avoid XSS attack.
      for (let i in variables) {
        let value = variables[i];
        if (
          typeof value === "string" &&
          value.indexOf("<") >= 0 &&
          value.indexOf(">") >= 0
        ) {
          value = escapeHtml(value);
        }
        variables[i] = value;
      }
    }

    try {
      msg = new IntlMessageFormat(msg, currentLocale, formats); // TODO memorize
      msg = msg.format(variables);
      return msg;
    } catch (err) {
      console.warn(`react-intl-universal format message failed for key='${key}'`, err);
      return "";
    }
  }

  /**
   * Get the formatted html message by key.
   * @param {string} key The string representing key in locale data file
   * @param {Object} variables Variables in message
   * @returns {React.Element} message
  */
  getHTML(key, variables) {
    let msg = this.get(key, variables);
    if (msg) {
      const el = React.createElement("span", {
        dangerouslySetInnerHTML: {
          __html: msg
        }
      });
      // when key exists, it should still return element if there's defaultMessage() after getHTML()
      const defaultMessage = () => el;
      return Object.assign({ defaultMessage: defaultMessage, d: defaultMessage }, el);
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
   * Helper: determine user's locale via URL, cookie, and browser's language.
   * You may not this API, if you have other rules to determine user's locale.
   * @param {string} options.urlLocaleKey URL's query Key to determine locale. Example: if URL=http://localhost?lang=en-US, then set it 'lang'
   * @param {string} options.cookieLocaleKey Cookie's Key to determine locale. Example: if cookie=lang:en-US, then set it 'lang'
   * @returns {string} determined locale such as 'en-US'
   */
  determineLocale(options = {}) {
    return (
      this.getLocaleFromURL(options) ||
      this.getLocaleFromCookie(options) ||
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

    return new Promise((resolve, reject) => {
      if (isPolyfill) {
        const lang = this.options.currentLocale.split("-")[0];
        load(`${SYS_LOCALE_DATA_URL}/${lang}.js`, (err, script) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  getLocaleFromCookie(options) {
    const { cookieLocaleKey } = options;
    if (cookieLocaleKey) {
      let params = cookie.parse(document.cookie);
      return params && params[cookieLocaleKey];
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

  getLocaleFromBrowser() {
    return navigator.language || navigator.userLanguage;
  }

}

module.exports = new ReactIntlUniversal();
