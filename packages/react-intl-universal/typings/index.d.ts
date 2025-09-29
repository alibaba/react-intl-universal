import { ReactNode } from "react";

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
   * @param {React.ReactNode[]} nodeList Array of React nodes to format
   * @param {Intl.ListFormatOptions} options Intl.ListFormat options (defaults to narrow style). See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat/ListFormat
   * @returns {React.ReactNode[]} Array of React nodes formatted with appropriate separators/conjunctions
   * 
   * @example
   * formatList(["str1", "str2", "str2"])
   * // Returns: ['str1', ',', 'str2', ',', 'str3'] in en-US
   * // Returns: ['str1', '、', 'str2', '、', 'str3'] in zh-CN
   */
  export function formatList(
    nodeList: React.ReactNode[],
    options?: Intl.ListFormatOptions,
  ): ReactNode[];

  /**
   * Returns locale-specific parentheses format for the current language
   * 
   * @description
   * This method determines whether to use full-width parentheses (（）) or 
   * half-width parentheses (()) based on the current locale. 
   * Full-width parentheses are used for Chinese, Japanese, and Korean locales,
   * while half-width parentheses are used for all other locales.
   * 
   * @param {React.ReactNode} node - The content to be wrapped in parentheses
   * @returns {ReactNode[]} An array containing:
   *   - Left parenthesis (（ or ( depending on locale)
   *   - The provided node/content
   *   - Right parenthesis (） or ) depending on locale)
   * 
   * @example
   * // For Chinese locale (zh-CN):
   * formatParentheses("Description") 
   * // => ['（', 'Description', '）'] => Render as: ```<>（Description）</>``` in React.js
   * 
   * // For English locale (en-US):
   * formatParentheses("Description") 
   * // => ['(', 'Description', ')']  => Render as: ```<>(Description)</>``` in React.js
   */
  export function formatParentheses(node: ReactNode): ReactNode[];

  /**
   * Returns locale-specific colon character for the current language
   */
  export function getColon(): string;

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
  };

  export default intl;
}

declare interface String {
  defaultMessage(msg: string | JSX.Element): string;
  d(msg: string | JSX.Element): string;
}
