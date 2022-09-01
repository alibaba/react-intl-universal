import ReactIntlUniversal from './ReactIntlUniversal';

const defaultInstance = new ReactIntlUniversal();
// resolved by CommonJS module loader
defaultInstance.ReactIntlUniversal = ReactIntlUniversal;
// react pattern: https://github.com/facebook/react/blob/main/packages/react/src/React.js
const get = defaultInstance.get.bind(defaultInstance);
const getHTML = defaultInstance.getHTML.bind(defaultInstance);
const formatMessage = defaultInstance.formatMessage.bind(defaultInstance);
const formatHTMLMessage = defaultInstance.formatHTMLMessage.bind(defaultInstance);
const determineLocale = defaultInstance.determineLocale.bind(defaultInstance);
const init = defaultInstance.init.bind(defaultInstance);
const getInitOptions = defaultInstance.getInitOptions.bind(defaultInstance);
const load = defaultInstance.load.bind(defaultInstance);
const getLocaleFromCookie = defaultInstance.getLocaleFromCookie.bind(defaultInstance);
const getLocaleFromLocalStorage = defaultInstance.getLocaleFromLocalStorage.bind(defaultInstance);
const getLocaleFromURL = defaultInstance.getLocaleFromURL.bind(defaultInstance);
const getDescendantProp = defaultInstance.getDescendantProp.bind(defaultInstance);
const getLocaleFromBrowser = defaultInstance.getLocaleFromBrowser.bind(defaultInstance);
// resolved by ECMAScript module loader
export {
  ReactIntlUniversal,
  get,
  getHTML,
  formatMessage,
  formatHTMLMessage,
  determineLocale,
  init,
  getInitOptions,
  load,
  getLocaleFromCookie,
  getLocaleFromLocalStorage,
  getLocaleFromURL,
  getDescendantProp,
  getLocaleFromBrowser,
  defaultInstance as default
};
