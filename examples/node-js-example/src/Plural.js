// const intl = require("react-intl-universal");
const intl = require("../../../lib");

module.exports = () => {
  console.log('\x1b[33m%s\x1b[0m', '--- Plural Examples ---');
  console.log('intl.get("PHOTO", { photoNum: 0 }) === ', intl.get("PHOTO", { photoNum: 0 }));
  console.log('intl.get("PHOTO", { photoNum: 1 }) === ', intl.get("PHOTO", { photoNum: 1 }));
  console.log('intl.get("PHOTO", { photoNum: 1000000 }) === ', intl.get("PHOTO", { photoNum: 1000000 }));
};
  