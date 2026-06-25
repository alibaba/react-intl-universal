import ReactIntlUniversal from './ReactIntlUniversal';

export type {
  ElementDefaultMessageMethods,
  HTMLMessage,
  IntlGetHook,
  LocaleData,
  LocaleMap,
  ReactIntlUniversalHTMLMessageDescriptor,
  ReactIntlUniversalMessageDescriptor,
  ReactIntlUniversalOptions,
  ReactIntlUniversalResolvedOptions,
  Variables,
  WarningHandler,
} from './ReactIntlUniversal';

export interface ReactIntlUniversalDefault extends ReactIntlUniversal {
  ReactIntlUniversal: typeof ReactIntlUniversal;
}

const defaultInstance = new ReactIntlUniversal() as ReactIntlUniversalDefault;
// resolved by CommonJS module loader
defaultInstance.ReactIntlUniversal = ReactIntlUniversal;
// react pattern: https://github.com/facebook/react/blob/main/packages/react/src/React.js
const get = defaultInstance.get.bind(defaultInstance) as ReactIntlUniversal["get"];
const getHTML = defaultInstance.getHTML.bind(defaultInstance) as ReactIntlUniversal["getHTML"];
const formatMessage = defaultInstance.formatMessage.bind(defaultInstance) as ReactIntlUniversal["formatMessage"];
const formatHTMLMessage = defaultInstance.formatHTMLMessage.bind(defaultInstance) as ReactIntlUniversal["formatHTMLMessage"];
const determineLocale = defaultInstance.determineLocale.bind(defaultInstance) as ReactIntlUniversal["determineLocale"];
const changeCurrentLocale = defaultInstance.changeCurrentLocale.bind(defaultInstance) as ReactIntlUniversal["changeCurrentLocale"];
const init = defaultInstance.init.bind(defaultInstance) as ReactIntlUniversal["init"];
const getInitOptions = defaultInstance.getInitOptions.bind(defaultInstance) as ReactIntlUniversal["getInitOptions"];
const load = defaultInstance.load.bind(defaultInstance) as ReactIntlUniversal["load"];
const getLocaleFromCookie = defaultInstance.getLocaleFromCookie.bind(defaultInstance) as ReactIntlUniversal["getLocaleFromCookie"];
const getLocaleFromLocalStorage = defaultInstance.getLocaleFromLocalStorage.bind(defaultInstance) as ReactIntlUniversal["getLocaleFromLocalStorage"];
const getLocaleFromURL = defaultInstance.getLocaleFromURL.bind(defaultInstance) as ReactIntlUniversal["getLocaleFromURL"];
const getDescendantProp = defaultInstance.getDescendantProp.bind(defaultInstance) as ReactIntlUniversal["getDescendantProp"];
const getLocaleFromBrowser = defaultInstance.getLocaleFromBrowser.bind(defaultInstance) as ReactIntlUniversal["getLocaleFromBrowser"];
const formatList = defaultInstance.formatList.bind(defaultInstance) as ReactIntlUniversal["formatList"];
const formatParentheses = defaultInstance.formatParentheses.bind(defaultInstance) as ReactIntlUniversal["formatParentheses"];
const getColon = defaultInstance.getColon.bind(defaultInstance) as ReactIntlUniversal["getColon"];
const formatNumber = defaultInstance.formatNumber.bind(defaultInstance) as ReactIntlUniversal["formatNumber"];
// resolved by ECMAScript module loader
export {
  ReactIntlUniversal,
  get,
  getHTML,
  formatMessage,
  formatHTMLMessage,
  determineLocale,
  changeCurrentLocale,
  init,
  getInitOptions,
  load,
  getLocaleFromCookie,
  getLocaleFromLocalStorage,
  getLocaleFromURL,
  getDescendantProp,
  getLocaleFromBrowser,
  formatList,
  formatParentheses,
  getColon,
  formatNumber,
  defaultInstance as default
};
