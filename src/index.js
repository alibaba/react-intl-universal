// import IntlPolyfill from "intl";
// import React from "react";
import IntlMessageFormat from "intl-messageformat";
import escapeHtml from "escape-html";
import cookie from "cookie";
import queryParser from "querystring";
import load from "load-script";
// import invariant from "invariant";
// import "console-polyfill";
// import * as constants from "./constants";


const currency = ["AFN","EUR","ALL","DZD","USD","AOA","XCD","ARS","AMD","AWG","AUD","AZN","BSD","BHD","BDT","BBD","BYN","BZD","XOF","BMD","INR","BTN","BOB","BOV","BAM","BWP","NOK","BRL","BND","BGN","BIF","CVE","KHR","XAF","CAD","KYD","CLP","CLF","CNY","COP","COU","KMF","CDF","NZD","CRC","HRK","CUP","CUC","ANG","CZK","DKK","DJF","DOP","EGP","SVC","ERN","ETB","FKP","FJD","XPF","GMD","GEL","GHS","GIP","GTQ","GBP","GNF","GYD","HTG","HNL","HKD","HUF","ISK","IDR","XDR","IRR","IQD","ILS","JMD","JPY","JOD","KZT","KES","KPW","KRW","KWD","KGS","LAK","LBP","LSL","ZAR","LRD","LYD","CHF","MOP","MKD","MGA","MWK","MYR","MVR","MRO","MUR","XUA","MXN","MXV","MDL","MNT","MAD","MZN","MMK","NAD","NPR","NIO","NGN","OMR","PKR","PAB","PGK","PYG","PEN","PHP","PLN","QAR","RON","RUB","RWF","SHP","WST","STD","SAR","RSD","SCR","SLL","SGD","XSU","SBD","SOS","SSP","LKR","SDG","SRD","SZL","SEK","CHE","CHW","SYP","TWD","TJS","TZS","THB","TOP","TTD","TND","TRY","TMT","UGX","UAH","AED","USN","UYU","UYI","UZS","VUV","VEF","VND","YER","ZMW","ZWL","XBA","XBB","XBC","XBD","XTS","XXX","XAU","XPD","XPT","XAG"];
const numberFormat = {};
for (var i = 0; i < currency.length; i++) {
  numberFormat[currency[i]] = {
    style: 'currency',
    currency: currency[i]
  };
}
const defaultFormats = {
  number: numberFormat
}


const SYS_LOCALE_DATA_URL =
  "https://g.alicdn.com/alishu/common/0.0.86/locale-data";

let isPolyfill = false;
const isBrowser = typeof window !== "undefined";

// if (isBrowser) {
//   if (typeof window.Intl === "undefined") {
//     window.Intl = IntlPolyfill;
//     isPolyfill = true;
//   }
// } else {
//   global.Intl = IntlPolyfill;
// }

String.prototype.defaultMessage = String.prototype.d = function (msg) {
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
    // invariant(key, "key is required");
    const { locales, currentLocale, formats } = this.options;

    if (!locales || !locales[currentLocale]) {
      return "";
    }
    let msg = this.getDescendantProp(locales[currentLocale], key);
    if (msg == null) {
      console.warn(
        `intl-universal key "${key}" not defined in ${currentLocale}`
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
      console.warn(
        `intl-universal format message failed for key='${key}'`,
        err
      );
      return "";
    }
  }

  /**
   * Get the formatted html message by key.
   * @param {string} key The string representing key in locale data file
   * @param {Object} variables Variables in message
   * @returns {React.Element} message
  */
  // getHTML(key, variables) {
  //   let msg = this.get(key, variables);
  //   if (msg) {
  //     const el = React.createElement("span", {
  //       dangerouslySetInnerHTML: {
  //         __html: msg
  //       }
  //     });
  //     // when key exists, it should still return element if there's defaultMessage() after getHTML()
  //     const defaultMessage = () => el;
  //     return Object.assign(
  //       { defaultMessage: defaultMessage, d: defaultMessage },
  //       el
  //     );
  //   }
  //   return "";
  // }

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

  // /**
  //  * As same as getHTML(...) API
  //  * @param {Object} options 
  //  * @param {string} options.id 
  //  * @param {React.Element} options.defaultMessage
  //  * @param {Object} variables Variables in message
  //  * @returns {React.Element} message
  // */
  // formatHTMLMessage(messageDescriptor, variables) {
  //   const { id, defaultMessage } = messageDescriptor;
  //   return this.getHTML(id, variables).defaultMessage(defaultMessage);
  // }

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
    // invariant(options.currentLocale, "options.currentLocale is required");
    // invariant(options.locales, "options.locales is required");

    Object.assign(this.options, options);

    this.options.formats = Object.assign(
      {},
      this.options.formats,
      defaultFormats
    );

    return new Promise((resolve, reject) => {
      const lang = this.options.currentLocale.split("-")[0];
      if (isBrowser) {
        if (isPolyfill) {          
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
      } else {
        // require(`intl/locale-data/jsonp/${lang}.js`);
        // TODO rquired on demand
        require(`intl/locale-data/jsonp/en.js`);
        require(`intl/locale-data/jsonp/zh.js`);
        require(`intl/locale-data/jsonp/fr.js`);
        require(`intl/locale-data/jsonp/ja.js`);
        require(`intl/locale-data/jsonp/de.js`);
        require(`intl/locale-data/jsonp/es.js`);
        require(`intl/locale-data/jsonp/ko.js`);
        require(`intl/locale-data/jsonp/pt.js`);
        require(`intl/locale-data/jsonp/it.js`);
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

  getDescendantProp(locale, key) {
    const msg = key.split(".").reduce(function(a, b) {
      return (a != undefined) ? a[b] : a ;
    }, locale);

    return msg;
  }

  getLocaleFromBrowser() {
    return navigator.language || navigator.userLanguage;
  }
}

window.IntlUniversal = ReactIntlUniversal;

// module.exports = new ReactIntlUniversal();
