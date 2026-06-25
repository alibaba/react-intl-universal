import React, { type ReactElement, type ReactNode } from "react";
import { IntlMessageFormat, type Formats } from "intl-messageformat";
import escapeHtml from "escape-html";
import invariant from "invariant";
import merge from "lodash.merge";
import * as constants from "./constants";

export type LocaleData = Record<string, any>;
export type LocaleMap = Record<string, LocaleData>;
export type Variables = Record<string, any>;
export type WarningHandler = (...msg: any[]) => void;
export type IntlGetHook = (key: string, currentLocale: string | null) => void;

export interface ReactIntlUniversalOptions {
  currentLocale?: string | null;
  locales?: LocaleMap;
  warningHandler?: WarningHandler;
  escapeHtml?: boolean;
  fallbackLocale?: string | null;
  debug?: boolean;
  dataKey?: string;
  formats?: Partial<Formats>;
  intlGetHook?: IntlGetHook;
  urlLocaleKey?: string;
  cookieLocaleKey?: string;
  localStorageLocaleKey?: string;
  commonLocaleDataUrls?: Record<string, string>;
}

export interface ReactIntlUniversalResolvedOptions {
  currentLocale: string | null;
  locales: LocaleMap;
  warningHandler: WarningHandler;
  escapeHtml: boolean;
  fallbackLocale: string | null;
  debug: boolean;
  dataKey: string;
  formats?: Partial<Formats>;
  intlGetHook?: IntlGetHook;
  urlLocaleKey?: string;
  cookieLocaleKey?: string;
  localStorageLocaleKey?: string;
  commonLocaleDataUrls?: Record<string, string>;
}

export interface ReactIntlUniversalMessageDescriptor {
  id: string;
  defaultMessage?: string;
}

export interface ReactIntlUniversalHTMLMessageDescriptor {
  id: string;
  defaultMessage?: string | ReactElement;
}

export interface ElementDefaultMessageMethods {
  defaultMessage(msg?: string | ReactElement): ReactElement;
  d(msg?: string | ReactElement): ReactElement;
}

export type HTMLMessage = string | (ReactElement & ElementDefaultMessageMethods);

declare global {
  interface Navigator {
    userLanguage?: string;
  }

  interface String {
    defaultMessage(msg?: string): string;
    defaultMessage<T extends ReactElement>(msg: T): string | T;
    defaultMessage(msg: string | ReactElement): string | ReactElement;
    d(msg?: string): string;
    d<T extends ReactElement>(msg: T): string | T;
    d(msg: string | ReactElement): string | ReactElement;
  }
}

function stringDefaultMessage<T extends string | ReactElement>(
  this: string | String,
  msg?: T
): string | T {
  return this.toString() || msg || "";
}

String.prototype.defaultMessage = stringDefaultMessage as String["defaultMessage"];
String.prototype.d = stringDefaultMessage as String["d"];

class ReactIntlUniversal {
  options: ReactIntlUniversalResolvedOptions;

  constructor() {
    this.options = {
      currentLocale: null, // Current locale such as 'en-US'
      locales: {}, // app locale data like {"en-US":{"key1":"value1"},"zh-CN":{"key1":"值1"}}
      warningHandler: function warn(...msg: any[]) { console.warn(...msg) }, // ability to accumulate missing messages using third party services
      escapeHtml: true, // disable escape html in variable mode
      fallbackLocale: null, // Locale to use if a key is not found in the current locale
      debug: false, // If debugger mode is on, the message will be wrapped by a span
      dataKey: 'data-i18n-key', // If debugger mode is on, the message will be wrapped by a span with this data key
    };
  }

  /**
   * Get the formatted message by key
   * @param key The string representing key in locale data file
   * @param variables Variables in message
   * @returns message
   */
  _getFormattedMessage(key: string, variables?: Variables): string {
    if (this.options.intlGetHook) {
      try {
        this.options.intlGetHook(key, this.options.currentLocale);
      } catch (e) {
        console.log('intl get hook error: ', e);
      }
    }
    invariant(key, "key is required");
    const { locales, currentLocale, formats } = this.options;

    // 1. check if the locale data and key exists
    if (!currentLocale || !locales || !locales[currentLocale]) {
      let errorMsg = `react-intl-universal locales data "${currentLocale}" not exists.`;
      if (!currentLocale) {
        errorMsg += `Check if the key "${key}" is used before it is initialized. More info: https://github.com/alibaba/react-intl-universal/issues/144#issuecomment-1345193138`;
      }
      this.options.warningHandler(errorMsg);
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

    // 2. handle security issue for variables
    if (variables) {
      variables = Object.assign({}, variables);
      // HTML message with variables. Escape it to avoid XSS attack.
      for (let i in variables) {
        let value = variables[i];
        if (
          this.options.escapeHtml === true &&
          (typeof value === "string" || value instanceof String) &&
          value.indexOf("<") >= 0
        ) {
          value = escapeHtml(value.toString());
        }
        variables[i] = value;
      }
    }

    // 3. resolve variables
    try {
      let finalMsg;
      if (variables) { // format message with variables
        const msgFormatter = new IntlMessageFormat(String(msg), currentLocale, formats, {
          ignoreTag: true
        });
        finalMsg = msgFormatter.format(variables);
      } else { // no variables, just return the message
        finalMsg = msg;
      }
      return finalMsg as string;
    } catch (err) {
      this.options.warningHandler(
        `react-intl-universal format message failed for key='${key}'.`,
        err instanceof Error ? err.message : String(err)
      );
      return msg as string;
    }
  }

  /**
   * Get the formatted message by key
   * @param key The string representing key in locale data file
   * @param variables Variables in message
   * @returns message
   */
  get(key: string, variables?: Variables): string {
    const msg = this._getFormattedMessage(key, variables);
    return (this.options.debug ? this._getSpanElementMessage(key, msg) : msg) as unknown as string;
  }

  /**
   * Get the formatted html message by key.
   * @param key The string representing key in locale data file
   * @param variables Variables in message
   * @returns html message
   */
  getHTML(key: string, variables?: Variables): HTMLMessage {
    const msg = this._getFormattedMessage(key, variables);
    if (msg) {
      return this._getSpanElementMessage(key, msg);
    }
    return "";
  }

  /**
   * As same as get(...) API
   * @param messageDescriptor options
   * @param variables Variables in message
   * @returns message
   */
  formatMessage(
    messageDescriptor: ReactIntlUniversalMessageDescriptor,
    variables?: Variables
  ): string {
    const { id, defaultMessage } = messageDescriptor;
    return this.get(id, variables).defaultMessage(defaultMessage ?? "");
  }

  /**
   * As same as getHTML(...) API
   * @param messageDescriptor options
   * @param variables Variables in message
   * @returns message
   */
  formatHTMLMessage(
    messageDescriptor: ReactIntlUniversalHTMLMessageDescriptor,
    variables?: Variables
  ): string | ReactElement {
    const { id, defaultMessage } = messageDescriptor;
    return this.getHTML(id, variables).defaultMessage(defaultMessage ?? "");
  }

  /**
   * Helper: determine user's locale via URL, cookie, localStorage, and browser's language.
   * You may not need this API, if you have other rules to determine user's locale.
   * @param options options to determine locale
   * @returns determined locale such as 'en-US'
   */
  determineLocale(options: ReactIntlUniversalOptions = {}): string | null | undefined {
    return (
      this.getLocaleFromURL(options) ||
      this.getLocaleFromCookie(options) ||
      this.getLocaleFromLocalStorage(options) ||
      this.getLocaleFromBrowser()
    );
  }

  /**
   * Change current locale
   * @param newLocale Current locale such as 'en-US'
   */
  changeCurrentLocale(newLocale: string): void {
    if (!this.options.locales || !this.options.locales[newLocale]) {
      let errorMsg = `react-intl-universal locales data "${newLocale}" not exists.`;
      if (!this.options.locales) {
        errorMsg += 'You should call init function first.'
      }
      this.options.warningHandler(errorMsg);
      return;
    }
    this.options.currentLocale = newLocale;
  }

  /**
   * Initialize properties and load CLDR locale data according to currentLocale
   * @param options init options
   * @returns promise for backward compatibility
   */
  init(options: ReactIntlUniversalOptions = {}): Promise<void> {
    invariant(options.currentLocale, "options.currentLocale is required");
    invariant(options.locales, "options.locales is required");

    Object.assign(this.options, options);

    this.options.formats = Object.assign(
      {},
      this.options.formats,
      constants.defaultFormats
    );

    return new Promise((resolve) => {
      // init() will not load external common locale data anymore.
      // But, it still return a Promise for backward compatibility.
      resolve();
    });
  }

  /**
   * Get the inital options
   */
  getInitOptions(): ReactIntlUniversalResolvedOptions {
    return this.options;
  }

  /**
   * Load more locales after init
   */
  load(locales: LocaleMap): void {
    merge(this.options.locales, locales);
  }

  getLocaleFromCookie(options: ReactIntlUniversalOptions): string | undefined {
    const { cookieLocaleKey } = options;
    if (cookieLocaleKey && typeof document !== 'undefined') {
      const cookies = document.cookie.split(';'); // Split on semicolon only
      const cookieObj: Record<string, string> = {};

      cookies.forEach((cookie) => {
        const [key, value] = cookie.trim().split('='); // Trim leading/trailing spaces
        if (key) {
          cookieObj[key] = decodeURIComponent(value); // cookie values may be URL-encoded
        }
      });
      return cookieObj[cookieLocaleKey];
    }
  }

  getLocaleFromLocalStorage(options: ReactIntlUniversalOptions): string | null | undefined {
    const { localStorageLocaleKey } = options;
    if (localStorageLocaleKey && window.localStorage) {
      return localStorage.getItem(localStorageLocaleKey);
    }
  }

  getLocaleFromURL(options: ReactIntlUniversalOptions): string | null | undefined {
    const { urlLocaleKey } = options;
    if (urlLocaleKey) {
      const query = location.search.split("?");
      if (query.length >= 2) {
        const params = new URLSearchParams(query[1]);
        if (params.has(urlLocaleKey)) {
          return params.get(urlLocaleKey);
        }
      }
    }
  }

  getDescendantProp(locale: LocaleData, key: string): any {

    if (locale[key]) {
      return locale[key];
    }

    const msg = key.split(".").reduce(function (a, b) {
      return (a != undefined) ? a[b] : a;
    }, locale);

    return msg;
  }

  getLocaleFromBrowser(): string | undefined {
    return navigator.language || navigator.userLanguage;
  }

  formatList(nodeList: ReactNode[], options: Intl.ListFormatOptions = { style: 'narrow' }): ReactNode[] {
    if (!Array.isArray(nodeList)) return []
    if (nodeList.length === 0) return [];

    // Create a mapping from placeholder strings to React nodes
    const nodeMap: Record<string, ReactNode> = {};
    const placeholders = nodeList.map((node, index) => {
      const placeholder = index.toString();
      nodeMap[placeholder] = node;
      return placeholder;
    });

    // Create list formatter with specified locale and options
    const formatter = new Intl.ListFormat(this.options.currentLocale || undefined, options);

    // Get formatted parts (elements, literals like separators/conjunctions)
    const parts = formatter.formatToParts(placeholders);

    // Transform formatted parts back to React nodes
    return parts.map(part => {
      // Element is replaced with original nodes
      if (part.type === 'element') {
        return nodeMap[part.value];
      }
      // Literal remains as a string
      return part.value;
    });
  }

  formatParentheses(node: ReactNode): ReactNode[] {
    const currentLocale = this.options.currentLocale;
    const isFullWidth = constants.fullWidthLocales.includes(currentLocale || "");
    return isFullWidth ? ['（', node, '）'] : ['(', node, ')'];
  }

  getColon(): string {
    const currentLocale = this.options.currentLocale;
    const isFullWidth = constants.fullWidthLocales.includes(currentLocale || "");
    return isFullWidth ? '：' : ': ';
  }

  formatNumber(number: number): string | number;
  formatNumber<T>(number: T): T;
  formatNumber(number: unknown): unknown {
    // Return original value if not a number
    if (typeof number !== 'number' || isNaN(number)) {
      return number;
    }
    try {
      return new Intl.NumberFormat(this.options.currentLocale || undefined, {}).format(number);
    } catch (error) {
      console.error('Error formatting number:', error);
      return number;
    }
  }

  _getSpanElementMessage(key: string, msg: string): ReactElement & ElementDefaultMessageMethods {
    const options: Record<string, unknown> = {
      dangerouslySetInnerHTML: {
        __html: msg
      }
    };
    if (this.options.debug) {
      options[this.options.dataKey] = key
    }
    const el = React.createElement('span', options);
    // when key exists, it should still return element if there's defaultMessage() after getHTML()
    const defaultMessage = () => el;
    return Object.assign(
      { defaultMessage: defaultMessage, d: defaultMessage },
      el
    );
  }
}

export default ReactIntlUniversal;
