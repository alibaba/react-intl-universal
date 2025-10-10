import { JSX, ReactNode } from "react";

declare module "react-intl-universal" {
  /**
   * Change current locale
   * @param {string} newLocale Current locale such as 'en-US'
   */
  export function changeCurrentLocale(newLocale: string): void;

  /**
   * Helper: determine user's locale via URL, cookie, and browser's language.
   * You may not need this API, if you have other rules to determine user's locale.
   * @param {string} options.urlLocaleKey URL's query Key to determine locale. Example: if URL=http://localhost?lang=en-US, then set it 'lang'
   * @param {string} options.cookieLocaleKey Cookie's Key to determine locale. Example: if cookie=lang:en-US, then set it 'lang'
   * @param {string} options.localStorageLocaleKey LocalStorage's Key to determine locale such as 'lang'
   * @returns {string} determined locale such as 'en-US'
   */
  export function determineLocale(options: ReactIntlUniversalOptions): string;

  /**
   * Provide React-Intl compatibility, same as getHTML(...) API.
   */
  export function formatHTMLMessage(messageDescriptor: ReactIntlUniversalMessageDescriptor): string;

  /**
   * Provide React-Intl compatibility, same as getHTML(...) API.
   */
  export function formatHTMLMessage(messageDescriptor: ReactIntlUniversalMessageDescriptor, variables: any): string;

  /**
   * Provide React-Intl compatibility, same as get(...) API.
   */
  export function formatMessage(messageDescriptor: ReactIntlUniversalMessageDescriptor): string;

  /**
   * Provide React-Intl compatibility, same as get(...) API.
   */
  export function formatMessage(messageDescriptor: ReactIntlUniversalMessageDescriptor, variables: any): string;

  /**
   * Get the formatted message by key
   * @param {string} key The string representing key in locale data file
   * @returns {string} message
   */
  export function get(key: string): string;

  /**
   * Get the formatted message by key
   * @param {string} key The string representing key in locale data file
   * @param {Object} variables Variables in message
   * @returns {string} message
   */
  export function get(key: string, variables?: any): string;

  /**
   * Get the formatted html message by key.
   * @param {string} key The string representing key in locale data file
   * @param {Object} variables Variables in message
   * @returns {React.ReactElement} message
   */
  export function getHTML(key: string, variables?: any): string;

  /**
   * Get the inital options 
   * @returns {Object} options includes currentLocale and locales
   */
  export function getInitOptions(): ReactIntlUniversalOptions;

  /**
   * Initialize properties and load CLDR locale data according to currentLocale
   * @param {Object} options
   * @param {string} options.currentLocale Current locale such as 'en-US'
   * @param {Object} options.locales App locale data like {"en-US":{"key1":"value1"},"zh-CN":{"key1":"值1"}}
   * @param {Object} options.warningHandler Ability to accumulate missing messages using third party services like Sentry
   * @param {string} options.fallbackLocale Fallback locale such as 'zh-CN' to use if a key is not found in the current locale
   * @param {boolean} options.escapeHtml To escape html. Default value is true.
   * @param {boolean} options.debug debug mode
   * @returns {Promise}
   */
  export function init(options: ReactIntlUniversalOptions): Promise<void>;

  /**
   * Load more locales after init
   * @param {Object} locales App locale data 
   */
  export function load(locales: { [key: string]: any }): void;


  /**
   * Formats a list of React nodes for proper internationalized formatting.
   * This method properly handles locale-specific list formatting with appropriate separators and conjunctions.
   * 
   * @param {React.ReactNode[]} nodeList - Array of React nodes to format.
   * @param {Intl.ListFormatOptions} options - Intl.ListFormat options for customizing the formatting style and type.
   *   - style: 'long' | 'short' | 'narrow' - Controls the length of the separators (default: 'narrow')
   *   - type: 'conjunction' | 'disjunction' | 'unit' - Controls the type of list pattern (default: 'conjunction')
   *   See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat/ListFormat for details.
   * @returns {React.ReactNode[]} Array of React nodes formatted with locale-appropriate separators and conjunctions.
   * 
   * @example
   * // For English locale (en-US):
   * formatList(["str1", "str2", "str3"])
   * // Returns: ['str1', ', ', 'str2', ', ', 'str3'] (with comma separators) => Render as: ``str1, str2, str3``` in React.js
   * 
   * @example
   * // For Chinese locale (zh-CN):
   * formatList(["str1", "str2", "str3"])
   * // Returns: ['str1', '、', 'str2', '、', 'str3'] (with ideographic comma separators) => Render as: ``str1、str2、str3``` in React.js
   * 
   * @example
   * // With custom options for disjunction (or) in English:
   * formatList(["str1", "str2", "str3"], { type: "disjunction" })
   * // Returns: ['str1', ', ', 'str2', ', or ', 'str3']  => Render as: ``str1, str2, or str3``` in React.js
   */
  export function formatList(
    nodeList: React.ReactNode[],
    options?: Intl.ListFormatOptions,
  ): ReactNode[];

  /**
   * Returns locale-specific parentheses format for the current language.
   * This method wraps the provided content with appropriate parentheses based on the current locale.
   * 
   * @description
   * This method determines whether to use full-width parentheses "（）" or 
   * half-width parentheses "()" based on the current locale. 
   * Full-width parentheses are used for Chinese, Japanese, and Korean locales,
   * while half-width parentheses are used for all other locales.
   * This ensures proper typographic conventions are followed for different languages.
   * 
   * @param {React.ReactNode} node - The content to be wrapped in parentheses. Can be a string, number, or React element.
   * @returns {ReactNode[]} An array containing:
   *   - Left parenthesis "（" or "(" depending on locale
   *   - The provided node/content
   *   - Right parenthesis "）" or ")" depending on locale
   * 
   * @example
   * // For Chinese locale (zh-CN):
   * formatParentheses("Description") 
   * // => ['（', 'Description', '）'] => Render as: ```<>（Description）</>``` in React.js
   * 
   * @example
   * // For English locale (en-US):
   * formatParentheses("Description") 
   * // => ['(', 'Description', ')']  => Render as: ```<>(Description)</>``` in React.js
   */
  export function formatParentheses(node: ReactNode): ReactNode[];

  /**
   * Returns locale-specific colon character for the current language.
   * 
   * @description
   * This method determines whether to use a full-width colon "：" or 
   * half-width colon ": " based on the current locale. 
   * 
   * @returns {string} The locale-appropriate colon character.
   *   - Full-width colon "：" for Chinese, Japanese, and Korean locales
   *   - Half-width colon ": " for all other locales
   * 
   * @example
   * // For Chinese locale (zh-CN):
   * getColon() 
   * // => "："
   * 
   * @example
   * // For English locale (en-US):
   * getColon() 
   * // => ": "
   * 
   * @example
   * // Usage in a React component:
   * <div>{intl.get("LABEL_NAME")}{intl.getColon()}{intl.get("VALUE")}</div>
   */
  export function getColon(): string;

  /**
   * Formats a number according to the current locale.
   * 
   * @description
   * This method formats a number according to the current locale's conventions,
   * including decimal separators, digit grouping, and other locale-specific formatting rules.
   * If the input is not a valid number, it returns the original value unchanged.
   * 
   * @param {number} number - The number to format. Can be an integer or float.
   * @returns {string} The formatted number.
   * 
   * @example
   * // For English locale (en-US):
   * formatNumber(1234.56) // => "1,234.56"
   * 
   * @example
   * // For German locale (de-DE):
   * formatNumber(1234.56) // => "1.234,56"
   * 
   * @example
   * // For Chinese locale (zh-CN):
   * formatNumber(1234.56) // => "1,234.56"
   * 
   * @example
   * // Invalid number input:
   * formatNumber("not-a-number") // => "not-a-number"
   */
  export function formatNumber(number: number): string;

  export interface ReactIntlUniversalOptions {
    currentLocale?: string;
    locales?: { [key: string]: any };
    fallbackLocale?: string;
    commonLocaleDataUrls?: { [key: string]: string };
    cookieLocaleKey?: string;
    urlLocaleKey?: string;
    localStorageLocaleKey?: string;
    warningHandler?: (message?: any, error?: any) => void;
    escapeHtml?: boolean;
    debug?: boolean;
    dataKey?: string;
  }

  export interface ReactIntlUniversalMessageDescriptor {
    id: string,
    defaultMessage?: string,
  }

  const intl: {
    determineLocale: typeof determineLocale;
    formatHTMLMessage: typeof formatHTMLMessage;
    formatMessage: typeof formatMessage;
    get: typeof get;
    getHTML: typeof getHTML;
    getInitOptions: typeof getInitOptions;
    init: typeof init;
    load: typeof load;
    formatList: typeof formatList;
    formatParentheses: typeof formatParentheses;
    getColon: typeof getColon;
    formatNumber: typeof formatNumber;
  };

  export default intl;
}

declare global {
  interface String {
    defaultMessage(msg: string | JSX.Element): string;
    d(msg: string | JSX.Element): string;
  }
}
