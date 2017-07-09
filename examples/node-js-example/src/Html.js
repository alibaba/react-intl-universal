// const intl = require("react-intl-universal");
const intl = require("../../../lib");

module.exports = () => {
  console.log('\x1b[33m%s\x1b[0m', '--- HTML Examples ---');
  console.log("intl.getHTML('TIP') === ", intl.getHTML('TIP').props.dangerouslySetInnerHTML.__html);
  console.log("intl.getHTML('TIP_VAR', { message: 'HTML with variables' }) === ", intl.getHTML('TIP_VAR', { message: 'HTML with variables' }).props.dangerouslySetInnerHTML.__html);
  console.log(`intl.getHTML('TIP_VAR', { message: '<script>alert＼"ReactIntlUniversal prevents from xss attack")</script>' }) === `, intl.getHTML('TIP_VAR', { message: '<script>alert("ReactIntlUniversal prevents from xss attack")</script>' }).props.dangerouslySetInnerHTML.__html);
}
