// const intl = require("react-intl-universal");
const intl = require("../../../lib");

module.exports = () => {
  console.log('\x1b[33m%s\x1b[0m', '--- Basic Examples ---');
  console.log('intl.get("SIMPLE") === ', intl.get("SIMPLE"));
  console.log('intl.get("HELLO", { name: "Tony", where: "Alibaba" }) === ', intl.get("HELLO", { name: "Tony", where: "Alibaba" }));
};
