// const intl = require("react-intl-universal");
const intl = require("../../../lib");

module.exports = () => {
  console.log('\x1b[33m%s\x1b[0m', '--- Currency Example ---');
  // FIXME CN¥，应该是¥
  console.log("intl.get('SALE_PRICE', {price: 123456.78}) === ", intl.get('SALE_PRICE', {price: 123456.78}));
};