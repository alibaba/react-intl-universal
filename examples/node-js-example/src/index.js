// TODO 
// const intl = require("react-intl-universal");
const intl = require("../../../lib");

// TODO more locales
const locales = {
  "en-US": require("../locales/en-US.js"),
  "zh-CN": require("../locales/zh-CN.js")
};

const currentLocale = Object.keys(locales)[1];

const basicExample = require("./Basic");
const pluralExample = require("./Plural");
const currencyExample = require("./Currency");
const dateExample = require("./Date");
// TODO html
// import HtmlExample =require("./Html");

// TODO for each locales
intl
  .init({
    currentLocale,
    locales
  })
  .then(() => {
    basicExample();
    pluralExample();
    currencyExample();
    dateExample();
  });
