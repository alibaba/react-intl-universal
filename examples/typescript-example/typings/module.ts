import * as en from '../src/locales/en.json';
declare module 'react-intl-universal' {
  export interface Message extends Record<keyof typeof en, string> {}
}
