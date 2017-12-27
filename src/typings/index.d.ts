declare module "react-intl-universal" {
    export interface ReactIntlUniversal {
        /**
         * Helper: determine user's locale via URL, cookie, and browser's language.
         * You may not this API, if you have other rules to determine user's locale.
         * @param {string} options.urlLocaleKey URL's query Key to determine locale. Example: if URL=http://localhost?lang=en-US, then set it 'lang'
         * @param {string} options.cookieLocaleKey Cookie's Key to determine locale. Example: if cookie=lang:en-US, then set it 'lang'
         * @returns {string} determined locale such as 'en-US'
         */
        determineLocale(options: ReactIntlUniversalOptions): string;

        /**
         * Provide React-Intl compatibility, same as getHTML(...) API.
         */
        formatHTMLMessage(messageDescriptor: ReactIntlUniversalMessageDescriptor): string;

        /**
         * Provide React-Intl compatibility, same as getHTML(...) API.
         */
        formatHTMLMessage(messageDescriptor: ReactIntlUniversalMessageDescriptor, variables: any): string;

        /**
         * Provide React-Intl compatibility, same as get(...) API.
         */
        formatMessage(messageDescriptor: ReactIntlUniversalMessageDescriptor): string;

        /**
         * Provide React-Intl compatibility, same as get(...) API.
         */
        formatMessage(messageDescriptor: ReactIntlUniversalMessageDescriptor, variables: any): string;

        /**
         * Get the formatted message by key
         * @param {string} key The string representing key in locale data file
         * @returns {string} message
         */
        get(key: string): string;

        /**
         * Get the formatted message by key
         * @param {string} key The string representing key in locale data file
         * @param {Object} variables Variables in message
         * @returns {string} message
         */
        get(key: string, value: any): string;

        /**
         * Get the formatted html message by key.
         * @param {string} key The string representing key in locale data file
         * @returns {React.Element} message
         */
        getHTML(key: string): string;

        /**
         * Get the formatted html message by key.
         * @param {string} key The string representing key in locale data file
         * @param {Object} variables Variables in message
         * @returns {React.Element} message
         */
        getHTML(key: string, value: any): string;

        getInitOptions(): ReactIntlUniversalOptions;
        getLocaleFromBrowser(): string;
        getLocaleFromCookie(options: ReactIntlUniversalOptions): void;
        getLocaleFromURL(options: ReactIntlUniversalOptions): void;

        /**
         * Initialize properties and load CLDR locale data according to currentLocale
         * @param {Object} options
         * @param {string} options.currentLocale Current locale such as 'en-US'
         * @param {string} options.locales App locale data like {"en-US":{"key1":"value1"},"zh-CN":{"key1":"值1"}}
         * @returns {Promise}
         */
        init(options: ReactIntlUniversalOptions): Promise<void>;
    }

    export interface ReactIntlUniversalOptions {
        cookieLocaleKey?: string;
        currentLocale?: string;
        locales: { [key: string]: any };
        urlLocaleKey?: string;
    }

    export interface ReactIntlUniversalMessageDescriptor {
        id: string,
        defaultMessage?: string,
    }
}


declare const ReactIntlUniversalInstance: ReactIntlUniversal;
export default ReactIntlUniversalInstance;
