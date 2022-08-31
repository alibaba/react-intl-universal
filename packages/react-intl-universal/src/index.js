import ReactIntlUniversal from './ReactIntlUniversal';

const defaultInstance = new ReactIntlUniversal();
// resolved by CommonJS module loader
defaultInstance.ReactIntlUniversal = ReactIntlUniversal;
export default defaultInstance;
// resolved by ECMAScript module loader
export { ReactIntlUniversal };
