import IntlMessageFormat from "intl-messageformat";

/**
 * Create an object that acts as a cache for internationalized messages.
 * This function uses Object.create(null) to ensure that the returned object
 * does not inherit any properties or methods from the global Object prototype.
 * 
 * @returns {Object} An empty object that can be used as a cache.
 */
export function createIntlCache() {
  return Object.create(null)
}

/**
 * Get the formatted message by key
 * @param {string} key The string representing key in locale data file
 * @param {Object} variables Variables in message
 * @param {string} currentLocale Current locale such as 'en-US'
 * @returns {string} message
 */
export function generateCacheKey(key, variables, currentLocale) {
  return key + JSON.stringify(variables) + currentLocale;
}

/**
 * Create and return a formatted message based on provided parameters.
 * This function takes in a message, a locale, optional formats, and variables, 
 * and returns the message formatted accordingly using IntlMessageFormat.
 * 
 * @param {string} msg The message string to be formatted
 * @param {string} currentLocale The locale in which the message should be formatted
 * @param {Object} formats formats to be applied to the message
 * @param {Object} variables Variables to replace placeholders in the message
 * @returns {string} The formatted message string
 */
export function createFormattedMessage(msg, currentLocale, formats, variables) {
  const msgFormatter = new IntlMessageFormat(msg, currentLocale, formats);
  return msgFormatter.format(variables);
}