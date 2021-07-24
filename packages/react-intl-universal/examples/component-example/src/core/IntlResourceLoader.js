import intl from 'react-intl-universal';

const locales = {
  'zh-CN': require('../locales/zh_CN.json'),
  'en-US': require('../locales/en_US.json'),
};

export default {
  load() {
    // Since intl is a singlton, you don't need to init it again. 
    // Just load the locale data in the component.
    intl.load(locales);
  }
};