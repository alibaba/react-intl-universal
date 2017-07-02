// const intl = require("react-intl-universal");
const intl = require("../../../lib");

module.exports = () => {
  console.log('\x1b[33m%s\x1b[0m', '--- Date Examples ---');
  console.log("intl.get('SALE_START', {start: new Date()}) === ", intl.get('SALE_START', {start: new Date()}));
  console.log("intl.get('SALE_END', {end: new Date()}) === ", intl.get('SALE_END', {end: new Date()}));
  console.log("intl.get('COUPON', {expires: new Date()}) === ", intl.get('COUPON', {expires: new Date()}));
}

