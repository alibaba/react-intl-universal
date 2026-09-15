import React from "react";
import ReactDOM from "react-dom";
import intl from "react-intl-universal";


import App from "./app/App.js";
import {DEFAULT_LOCALE, SUPPORTED_LOCALES} from "./i18n";
import enTranslationMessages from './locales/en.json';
import ruTranslationMessages from './locales/ru.json';
import amTranslationMessages from './locales/am.json';

let translation = {
    'en': enTranslationMessages,
    'ru': ruTranslationMessages,
    'am': amTranslationMessages
};
let currentLocale = intl.determineLocale({
    urlLocaleKey: "lang",
    cookieLocaleKey: "lang"
});
console.log(currentLocale, SUPPORTED_LOCALES, (SUPPORTED_LOCALES.indexOf(currentLocale) === -1));
if (SUPPORTED_LOCALES.indexOf(currentLocale) === -1) {
    currentLocale = DEFAULT_LOCALE;
    translation = enTranslationMessages;
}
console.log(currentLocale, translation[currentLocale]);

export const intlInit = intl.init({
    currentLocale: currentLocale,
    locales: {
        [currentLocale]: translation[currentLocale],
    }
});


const renderApp = () => {
    ReactDOM.render(
        <App locale={currentLocale}/>,
        document.getElementById('app'));
};
intlInit.then(() => {
    renderApp();
});

