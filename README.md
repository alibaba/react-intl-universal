# react-intl-universal
[react-intl-universal](https://github.com/alibaba/react-intl-universal) is a React internationalization package developed by [Alibaba Group](http://www.alibabagroup.com).



[![npm](https://img.shields.io/npm/dt/react-intl-universal.svg)](https://www.npmjs.com/package/react-intl-universal) [![npm](https://img.shields.io/npm/v/react-intl-universal.svg)](https://www.npmjs.com/package/react-intl-universal) [![npm](https://img.shields.io/npm/l/react-intl-universal.svg)](https://github.com/alibaba/react-intl-universal/blob/master/LICENSE.md)

## Features
- Can be used not only in React.Component but also in Vanilla JS.
- Simple. Only three main API and one optional helper.
- Display numbers, currency, dates and times for different locales.
- Pluralize labels in strings.
- Support variables in message.
- Support HTML in message.
- Support for 150+ languages.
- Runs in the browser and Node.js.
- Message format is strictly implemented by [ICU standards](http://userguide.icu-project.org/formatparse/messages).
- Locale data in [nested JSON format](https://github.com/alibaba/react-intl-universal/releases/tag/1.4.3) are supported.
- [react-intl-universal-extract](https://github.com/alibaba/react-intl-universal/tree/master/packages/react-intl-universal-extract) helps you generate a locale file easily.

## Live Demo
- [react-intl-universal demo](https://g.alicdn.com/alishu/common/0.0.95/intl-example/index.html)
- [CodeSandbox](https://codesandbox.io/s/727pw9zoqx)

## Why Another Internationalization Solution for React?
In case of internationalizing React apps, [react-intl](https://github.com/yahoo/react-intl) is one of most popular package in industry.  [react-intl](https://github.com/yahoo/react-intl) decorate your React.Component with wrapped component which is injected internationalized message dynamically so that the locale data is able to be loaded dynamically without reloading page. The following is the example code using  [react-intl](https://github.com/yahoo/react-intl).

```js
import { injectIntl } from 'react-intl';
class MyComponent extends Component {
  render() {
    const intl = this.props;
    const title = intl.formatMessage({ id: 'title' });
    return (<div>{title}</div>);
  }
};
export default injectIntl(MyComponent);
```

However, this approach introduces two major issues.

Firstly,  Internationalizing can be applied only in view layer such as React.Component. For Vanilla JS file, there's no way to internationalize it. For example, the following snippet is general form validator used by many React.Component in our apps. We definitely will not have such code separated in different React.Component in order to internationalize the warning message. Sadly, [react-intl](https://github.com/yahoo/react-intl) can't be used in Vanilla JS.

```js
export default const rules = {
  noSpace(value) {
    if (value.includes(' ')) {
      return 'Space is not allowed.';
    }
  }
};
```

Secondly,  since your React.Component is wrapped by another class, the behavior is not as expected in many way. For example, to get the instance of React.Component, you can't use the normal way like:
```js
class App {
  render() {
    <MyComponent ref="my"/>
  }
  getMyInstance() {
    console.log('getMyInstance', this.refs.my);
  }
}
```
Instead, you need to use the method ```getWrappedInstance()``` to get that.
```js
class MyComponent {...}
export default injectIntl(MyComponent, {withRef: true});

class App {
  render() {
    <MyComponent ref="my"/>
  }
  getMyInstance() {
    console.log('getMyInstance', this.refs.my.getWrappedInstance());
  }
}
```
Furthermore, your React.Component's properties are not inherited in subclass since component is injected by [react-intl](https://github.com/yahoo/react-intl). 

Due to the problem above, we create [react-intl-universal](https://www.npmjs.com/package/react-intl-universal) to internationalize React app using simple but powerful API.

## Get Started

### Install
```sh
npm install react-intl-universal --save
```

### Basic Example
In the following example, we initialize `intl` with app locale data (`locales`) and determine which locale is used dynamically (`currentLocale`). Then use `intl.get(...)` to get the internationalized message. That's all. Pretty simple!

Note that you are not necessary to load all locale data, just load the current locale data on demand. Please refer the [example](https://github.com/alibaba/react-intl-universal/blob/master/packages/react-intl-universal/examples/browser-example/src/App.js#L72-L88) for more detail.

```js
import intl from 'react-intl-universal';
// common locale data
import 'intl/locale-data/jsonp/en.js';
import 'intl/locale-data/jsonp/zh.js';
import enUS from './locales/en-US.js';
import zhCN from './locales/zh-CN.js';

// app locale data
const locales = {
  "en-US": enUS,
  "zh-CN": zhCN
};

class App extends Component {

  state = {initDone: false}

  componentDidMount() {
    this.loadLocales();
  }

  loadLocales() {
    // init method will load CLDR locale data according to currentLocale
    // react-intl-universal is singleton, so you should init it only once in your app
    intl.init({
      currentLocale: 'en-US', // TODO: determine locale here
      locales,
    })
    .then(() => {
      // After loading CLDR locale data, start to render
	  this.setState({initDone: true});
    });
  }

  render() {
    return (
      this.state.initDone &&
      <div>
        {intl.get('SIMPLE')}
      </div>
    );
  }

}
```

### Message With Variables
If the message contains variables the `{variable_name}` is substituted directly into the string. In the example below, there are two variables `{name}` and `{where}`,  the second argument representing the variables in `get` method are substituted into the string.

Locale data:
```json
{ "HELLO": "Hello, {name}. Welcome to {where}!" }
```

JS code:
```js
intl.get('HELLO', { name: 'Tony', where: 'Alibaba' }) // "Hello, Tony. Welcome to Alibaba!"
```

### Plural Form and Number Thousands Separators

Locale data:
```json
{ "PHOTO": "You have {num, plural, =0 {no photos.} =1 {one photo.} other {# photos.}}" }
```
JS code:
```js
intl.get('PHOTO', { num: 0 }); // "You have no photos."
intl.get('PHOTO', { num: 1 }); // "You have one photo."
intl.get('PHOTO', { num: 1000000 }); // "You have 1,000,000 photos."
```
Plural label supports standard [ICU Message syntax](http://userguide.icu-project.org/formatparse/messages).

Number thousands separators also varies according to the user's locale. According to this  [document](https://docs.oracle.com/cd/E19455-01/806-0169/overview-9/index.html), United States use a period to indicate the decimal place. Many other countries use a comma instead.

### Display Currency
Locale data:
```json
{ "SALE_PRICE": "The price is {price, number, USD}" }
```
JS code:
```js
intl.get('SALE_PRICE', { price: 123456.78 }); // The price is $123,456.78
```
As mentioned, the locale data is in [ICU Message format](http://userguide.icu-project.org/formatparse/messages).

The syntax is {name, type, format}. Here is description:

- name is the variable name in the message. In this case, it's `price`.
- type is the type of value such as `number`, `date`, and `time`.
- format is optional, and is additional information for the displaying format of the value. In this case, it's `USD`.

if `type` is `number` and `format` is omitted, the result is formatted number with [thousands separators](https://docs.oracle.com/cd/E19455-01/806-0169/overview-9/index.html). If `format` is one of [currency code](https://www.currency-iso.org/en/home/tables/table-a1.html), it will show in corresponding currency format.

### Display Dates
Locale data:
```json
{
  "SALE_START": "Sale begins {start, date}",
  "SALE_END": "Sale ends {end, date, long}"
}
```
JS code:
```js
intl.get('SALE_START', {start:new Date()}); // Sale begins 4/19/2017
intl.get('SALE_END', {end:new Date()}); // Sale ends April 19, 2017
```
If `type` is `date`, `format` has the following values:
- `short` shows date as shortest as possible
- `medium` shows short textual representation of the month
- `long` shows long textual representation of the month
- `full` shows dates with the most detail

### Display Times
Locale data:
```json
{
  "COUPON": "Coupon expires at {expires, time, medium}"
}
```
JS code:
```js
intl.get('COUPON', {expires:new Date()}); // Coupon expires at 6:45:44 PM
```
if `type` is `time`, `format` has the following values:
- `short` shows times with hours and minutes
- `medium` shows times with hours, minutes, and seconds
- `long` shows times with hours, minutes, seconds, and timezone

### Default Message
When the specific key does't exist in current locale, you may want to make it return a default message. Use `defaultMessage` method after `get` method. For example,

Locale data:
```json
{ "HELLO": "Hello, {name}" }
```


JS code:
```jsx
const name = 'Tony';
intl.get('HELLO', { name }).defaultMessage(`Hello, ${name}`); // "Hello, Tony"
```

Or using `d` for short:
```jsx
const name = 'Tony';
intl.get('HELLO', { name }).d(`Hello, ${name}`); // "Hello, Tony"
```

And `getHTML` also supports default message.
```jsx
const name = 'Tony';
intl.getHTML('HELLO').d(<div>Hello, {name}</div>) // React.Element with "<div>Hello, Tony</div>"
```


### HTML Message
The `get` method returns string message. For HTML message, use `getHTML` instead. For example,

Locale data:
```json
{ "TIP": "This is <span style='color:red'>HTML</span>" }
```
JS code:
```js
intl.getHTML('TIP'); // {React.Element}
```

### Helper
[react-intl-universal](https://www.npmjs.com/package/react-intl-universal) provides a utility helping developer determine the user's `currentLocale`. As the running examples, when user select a new locale, it redirect user new location like `http://localhost:3000?lang=en-US`. Then, we can use `intl.determineLocale` to get the locale from URL. It can also support determine user's locale via cookie, localStorage, and browser default language. Refer to the APIs section for more detail.

## Component Internationalization
When internationalizing a React component, you don't need to `intl.init` again.
You could make it as [peerDependency](https://github.com/alibaba/react-intl-universal/blob/master/examples/component-example/package.json#L34), then just [load](https://github.com/alibaba/react-intl-universal/tree/master/packages/react-intl-universal/examples/component-example/src/index.tsx#L16) the locale data in the compoent.

## App Examples
- [Browser Apps](https://github.com/alibaba/react-intl-universal/blob/master/packages/react-intl-universal/examples/browser-example/src/App.js)
- [Server-side App](https://github.com/alibaba/react-intl-universal/blob/master/packages/react-intl-universal/examples/node-js-example/src/App.js)
- [Component](https://github.com/alibaba/react-intl-universal/tree/master/packages/react-intl-universal/examples/component-example)

## APIs Definition

```js
  /**
   * Initialize properties and load CLDR locale data according to currentLocale
   * @param {Object} options
   * @param {string} options.escapeHtml To escape html. Default value is true.
   * @param {string} options.currentLocale Current locale such as 'en-US'
   * @param {Object} options.locales App locale data like {"en-US":{"key1":"value1"},"zh-CN":{"key1":"值1"}}
   * @param {Object} options.warningHandler Ability to accumulate missing messages using third party services. See https://github.com/alibaba/react-intl-universal/releases/tag/1.11.1
   * @param {string} options.fallbackLocale Fallback locale such as 'zh-CN' to use if a key is not found in the current locale
   * @returns {Promise}
   */
  init(options)


  /**
   * Load more locales after init
   * @param {Object} locales App locale data 
   */
  load(locales)


  /**
   * Get the formatted message by key
   * @param {string} key The string representing key in locale data file
   * @param {Object} variables Variables in message
   * @returns {string} message
   */
  get(key, variables)

  /**
   * Get the formatted html message by key.
   * @param {string} key The string representing key in locale data file
   * @param {Object} variables Variables in message
   * @returns {React.Element} message
  */
  getHTML(key, options)

  /**
   * Helper: determine user's locale via URL, cookie, and browser's language.
   * You may not need this API, if you have other rules to determine user's locale.
   * @param {string} options.urlLocaleKey URL's query Key to determine locale. Example: if URL=http://localhost?lang=en-US, then set it 'lang'
   * @param {string} options.cookieLocaleKey Cookie's Key to determine locale. Example: if cookie=lang:en-US, then set it 'lang'
   * @param {string} options.localStorageLocaleKey LocalStorage's Key to determine locale such as 'lang'
   * @returns {string} determined locale such as 'en-US'
   */
  determineLocale(options)

  /**
   * Get the inital options 
   * @returns {Object} options includes currentLocale and locales
   */
  getInitOptions()
```


## Compatibility with react-intl
As mentioned in the issue [Mirror react-intl API](https://github.com/alibaba/react-intl-universal/issues/2), to make people switch their existing React projects from [react-intl](https://github.com/yahoo/react-intl) to [react-intl-universal](https://www.npmjs.com/package/react-intl-universal). We provide two compatible APIs as following.

```js
  /**
   * As same as get(...) API
   * @param {Object} options 
   * @param {string} options.id 
   * @param {string} options.defaultMessage
   * @param {Object} variables Variables in message
   * @returns {string} message
  */
  formatMessage(options, variables)
```
```js
  /**
   * As same as getHTML(...) API
   * @param {Object} options 
   * @param {string} options.id 
   * @param {React.Element} options.defaultMessage
   * @param {Object} variables Variables in message
   * @returns {React.Element} message
  */
  formatHTMLMessage(options, variables)
```

For example, the `formatMessage` API

```js
const name = 'Tony';
intl.formatMessage({ id:'hello', defaultMessage: `Hello, ${name}`}, {name});
```
 
 is equivalent to `get` API
 
```js
const name = 'Tony';
intl.get('hello', {name}).d(`Hello, ${name}`);
```

And the `formatHTMLMessage` API
```js
const name = 'Tony';
intl.formatHTMLMessage({ id:'hello', defaultMessage: <div>Hello</div>}, {name});
```
 
 is equivalent to `getHTML` API
 
```js
const name = 'Tony';
intl.getHTML('hello', {name}).d(<div>Hello</div>);
```
 
## Browser Compatibility
Before using [react-intl-universal](https://www.npmjs.com/package/react-intl-universal), you need to include scripts below in HTML to support older browser.
```
<!--[if lt IE 9]>
<script src="//f.alicdn.com/es5-shim/4.5.7/es5-shim.min.js"></script>
<![endif]-->
<script>
if(typeof Promise!=="function"){document.write('<script src="//f.alicdn.com/es6-shim/0.35.1/??es6-shim.min.js,es6-sham.min.js"><\/script>')}
</script>
```

## Tools
- [react-intl-universal-extract](https://github.com/alibaba/react-intl-universal/tree/master/packages/react-intl-universal-extract): Extract default messages in application. This package will generate a json file which contains the extracted messages.
- [react-intl-universal-pseudo-converter](https://github.com/ceszare/react-intl-universal-pseudo-converter): A  [pseudo-localization](https://en.wikipedia.org/wiki/Pseudolocalization) tool for testing internationalization.


## License
This software is free to use under the BSD license.

## Donate
![image](https://user-images.githubusercontent.com/3455798/152097023-8f7f1724-65e7-493e-a9b5-7348e0f0c876.png)
