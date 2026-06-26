# react-intl-universal
[react-intl-universal](https://github.com/alibaba/react-intl-universal) is a React internationalization package developed by [Alibaba Group](http://www.alibabagroup.com).

[![react-intl-universal downloads](https://img.shields.io/npm/dw/react-intl-universal.svg)](https://npm-compare.com/react-intl-universal) [![react-intl-universal version](https://img.shields.io/npm/v/react-intl-universal.svg)](https://www.npmjs.com/package/react-intl-universal) [![npm](https://img.shields.io/npm/l/react-intl-universal.svg)](https://github.com/alibaba/react-intl-universal/blob/master/LICENSE.md)

## Features
- Can be used not only in React component but also in Vanilla JS.
- Simple. Only three main API and one optional helper.
- Display numbers, currency, dates and times for different locales.
- Pluralize labels in strings.
- Support variables in message.
- Support React rich text component interpolation in message.
- Support for 150+ languages.
- Runs in the browser and Node.js.
- Message format is strictly implemented by [ICU standards](http://userguide.icu-project.org/formatparse/messages).
- Locale data in [nested JSON format](https://github.com/alibaba/react-intl-universal/releases/tag/1.4.3) are supported.
- [react-intl-universal-extract](https://github.com/alibaba/react-intl-universal/tree/master/packages/react-intl-universal-extract) helps you generate a locale file easily.

## [Live Demo](https://alibaba.github.io/react-intl-universal/)

Explore the live demo to see the recommended usage patterns for react-intl-universal, including plain messages, variable interpolation, and rich React component interpolation.

[react-intl-universal Live Demo](https://alibaba.github.io/react-intl-universal/):

<a href="https://alibaba.github.io/react-intl-universal/">
  <img width="1200" src="https://img.alicdn.com/imgextra/i2/O1CN017uP7zd1h1tkr54P1z_!!6000000004218-2-tps-2280-1462.png" />
</a>

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

### App Examples
- [Next.js Apps](https://github.com/alibaba/react-intl-universal/blob/master/packages/react-intl-universal/examples/nextjs-example/pages/index.tsx)
- [Component](https://github.com/alibaba/react-intl-universal/blob/master/packages/react-intl-universal/examples/component-example/src/index.tsx)


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
When a key is missing from the current locale, use `.d(...)` / `.defaultMessage(...)` to provide a default message. These methods also give extraction tools a source message to collect, write into locale files, and send for translation. Call them after `get(...)`:

Locale data:
```json
{ "HELLO": "Hello, {name}" }
```


JS code:
```jsx
const name = 'Tony';
intl.get('HELLO', { name }).defaultMessage('Hello, {name}'); // "Hello, Tony"
```

Or using `d` for short:
```jsx
const name = 'Tony';
intl.get('HELLO', { name }).d('Hello, {name}'); // "Hello, Tony"
```

`getHTML` also supports default message as a legacy API, but new React code should prefer rich text interpolation with `get`.
```jsx
const name = 'Tony';
intl.getHTML('HELLO', { name }).d(<div>Hello, {name}</div>) // React.Element with "<div>Hello, Tony</div>"
```


### Rich Text Message
Use `get` as the unified API for messages. It supports plain strings, HTML-like markup, and React elements through rich tag formatter functions.

Locale data:
```json
{ "MORE_DETAIL": "Please read <link>{name} <strong>document</strong></link>." }
```
JSX code:
```jsx
intl.get('MORE_DETAIL', {
  name: 'Tony',
  link: chunks => <a href="/docs">{chunks}</a>,
  strong: chunks => <strong>{chunks}</strong>,
}).d('Please read <link>{name} <strong>document</strong></link>.');
// [
//   "Please read ",
//   <a href="/docs">Tony <strong>document</strong></a>,
//   "."
// ]
```

Each tag formatter receives the formatted content inside that tag. In the example above, `link` receives `["Tony ", <strong>document</strong>]` as `chunks` and wraps it with an anchor. This follows the [intl-messageformat rich text support](https://formatjs.github.io/docs/intl-messageformat/#rich-text-support) pattern.

Rich tag names are matched exactly and case-sensitively with formatter keys. Ordinary React node placeholders such as `{icon: <Icon />}` are not the supported rich text contract; use tag formatters like `<icon></icon>` when you need React components in translated text.

### Legacy HTML Message
`getHTML` is kept for backward compatibility with existing HTML string messages. For new code, prefer `get` so plain text, markup, and React components can use the same API.

Locale data:
```json
{ "TIP": "This is <span style='color:red'>HTML</span>" }
```
JS code:
```js
intl.getHTML('TIP'); // legacy React.Element wrapper
```

### Helper
[react-intl-universal](https://www.npmjs.com/package/react-intl-universal) provides a utility helping developer determine the user's `currentLocale`. As the running examples, when user select a new locale, it redirect user new location like `http://localhost:3000?lang=en-US`. Then, we can use `intl.determineLocale` to get the locale from URL. It can also support determine user's locale via cookie, localStorage, and browser default language. Refer to the APIs section for more detail.


## Debugger mode
When developing a website with multiple languages (i18n), translators are usually responsible for translating the content instead of the web developer. However, translators often struggle to find the specific message they need to edit on the webpage because they don't know its key. This leads to them having to ask the developer for the key, resulting in a lot of time wasted on communication.

To solve this issue, a solution is proposed: When the debugger mode in `react-intl-universal` is enabled, each message on the webpage will be wrapped in a special span element with the key "data-i18n-key". This way, translators can easily see the key of the message and make the necessary edits themselves using some message management system, without needing to ask the developer.

Enabling debugger mode:

```js
intl.init({
  // ...
  debug: true
})
```

Message will be wrapped in a span element with the key "data-i18n-key":

![debugger mode](https://github.com/alibaba/react-intl-universal/assets/3455798/172723f0-c241-4aee-9691-9abe4001b0f5)


## Component Internationalization
When internationalizing a React component, you don't need to `intl.init` again.
You could make it as [peerDependency](https://github.com/alibaba/react-intl-universal/blob/master/packages/react-intl-universal/examples/component-example/package.json#L34), then just [load](https://github.com/alibaba/react-intl-universal/tree/master/packages/react-intl-universal/examples/component-example/src/index.tsx#L16) the locale data in the compoent.

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
   * @param {boolean} options.debug If debugger mode is on, the message will be wrapped by a span with data key
   * @param {string} options.dataKey If debugger mode is on, the message will be wrapped by a span with this data key. Default value 'data-i18n-key'
   * @returns {Promise}
   */
  init(options)


  /**
   * Load more locales after init
   * @param {Object} locales App locale data 
   */
  load(locales)


  /**
   * Get the formatted message by key.
   * Returns string for plain messages.
   * Returns React-renderable chunks array when variables contain rich tag formatter functions
   * and every parsed rich tag has a matching formatter.
   * @param {string} key The string representing key in locale data file
   * @param {Object} variables Variables in message
   * @returns {string|React.ReactNode[]} message
   */
  get(key, variables)

  /**
   * Legacy API: get the formatted html message by key.
   * Prefer get(key, variables) with rich tag formatter functions for new React code.
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
  * Change current locale
  * @param {string} newLocale Current locale such as 'en-US'
  */
  changeCurrentLocale(newLocale)

  /**
   * Get the inital options 
   * @returns {Object} options includes currentLocale and locales
   */
  getInitOptions()

  /**
   * Formats a list of React nodes for proper internationalized formatting.
   * @param {React.ReactNode[]} nodeList - Array of React nodes to format.
   * @param {Intl.ListFormatOptions} options - Intl.ListFormat options.
   * @returns {React.ReactNode[]} Array of React nodes formatted with locale-appropriate separators.
   * 
   * @example
   * For en-US locale: formatList(["str1", "str2"]) => Returns: ["str1", ", ", "str2"] => Render as: "str1, str2" in React.js
   * For zh-CN locale: formatList(["str1", "str2"]) => Returns: ["str1", "、", "str2"] => Render as: "str1、str2" in React.js
   */
  formatList(nodeList, options)

  /**
   * Returns locale-specific parentheses format for the current language.
   * @param {React.ReactNode} node - The content to be wrapped in parentheses.
   * @returns {ReactNode[]} An array containing left parenthesis, content, and right parenthesis.
   * 
   * @example
   * For en-US locale: formatParentheses("str1") => Returns ["(", "str1", ")"] => Render as "(str1)" in React.js
   * For zh-CN locale: formatParentheses("str1") => Returns ["（", "str1", "）"] => Render as "（str1）" in React.js
   */
  formatParentheses(node)

  /**
   * Returns locale-specific colon character for the current language.
   * @returns {string} The locale-appropriate colon character.
   * 
   * @example
   * For en-US locale: <>{intl.get("LABEL_NAME")}{intl.getColon()}{intl.get("VALUE")}</> => Returns "label: value"
   * For zh-CN locale: <>{intl.get("LABEL_NAME")}{intl.getColon()}{intl.get("VALUE")}</> => Returns "label：value"
   */
  getColon()

  /**
   * Formats a number according to the current locale.
   * @param {number} number - The number to format.
   * @returns {string} The formatted number.
   * 
   * @example
   * For en-US locale: formatNumber(1234.56) => Returns "1,234.56"
   * For de-DE locale: formatNumber(1234.56) => Returns "1.234,567"
   * For fr-FR locale: formatNumber(1234.56) => Returns "1 234,567"
   */
  formatNumber(number)

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
   * @returns {string|React.ReactNode[]} message
  */
  formatMessage(options, variables)
```
```js
  /**
   * Legacy API: as same as getHTML(...) API
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
intl.formatMessage({ id:'hello', defaultMessage: 'Hello, {name}'}, {name});
```
 
 is equivalent to `get` API
 
```js
const name = 'Tony';
intl.get('hello', {name}).d('Hello, {name}');
```

And the legacy `formatHTMLMessage` API
```js
const name = 'Tony';
intl.formatHTMLMessage({ id:'hello', defaultMessage: <div>Hello</div>}, {name});
```
 
 is equivalent to `getHTML` API
 
```js
const name = 'Tony';
intl.getHTML('hello', {name}).d(<div>Hello</div>);
```
 
## FAQ
### 1. How to Internationalize Message in Constants Object

If constants are defined outside of a React component, the message in `constants.fruits` may get loaded before `intl.init(...)`. This can cause a warning to be displayed, such as `react-intl-universal locales data "null" not exists`.

```jsx
// Wrong: the message in constants.fruits is loaded before `intl.init(...)`
const constants = {
  fruits : [
    { label: intl.get('banana'), value: 'banana' },
    { label: intl.get('apple'), value: 'apple' },
  ]
}
function MyComponent() {
  return <Select dataSource={constants.fruits} />
}
```

To fix this, you should call `intl.init` before `render`.



#### Solution 1
Make the message object as a function, and call it at render function.

```jsx
const constants = {
    fruits : () => [  // as arrow function
        { label: intl.get('banana'), value: 'banana' },
        { label: intl.get('apple'), value: 'apple' },
    ]
}
function MyComponent() {
    // fruits is a function which returns message when rendering
    return <Select dataSource={constants.fruits()} />
}
```

#### Solution 2
Use [getter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get) syntax to make a function  call when that property is looked up

```jsx
const constants = {
  fruits: [
    {
      get label() {
        return intl.get("banana");
      },
      value: "banana",
    },
    {
      get label() {
        return intl.get("apple");
      },
      value: "apple",
    },
  ],
};
function MyComponent() {
  // When "label" property is looked up, it actually make a function call 
  return <Select dataSource={constants.fruits} />;
}
```


### 2. How to Put Links or Components in an Internationalized Message

For new React code, use `get` with rich tag formatter functions. The locale message controls the sentence, and React code controls the actual component.

**Legacy pattern:**

Locale data:
```json
{
  "more_detail": "Please refer to the <a>document</a> for more detail."
}
```

JSX code:
```jsx
const MyComp = (props) => {
  const onClick = (e) => {
    if (e.target.tagName === 'A') {
      // event handler for "A" tag in the message
    }
  };

  return (
    <span onClick={onClick}>
      {intl.getHTML('more_detail').d(<span>Please refer to the <a>document</a> for more detail.</span>)}
    </span>
  );
};
```

**Recommended pattern:**

Locale data:
```json
{
  "more_detail": "Please refer to the <link>document</link> for more detail."
}
```

JSX code:
```jsx
const MyComp = () => {
  const handleLinkClick = () => {
    // event handler for the link
  };

  return (
    <span>
      {intl.get('more_detail', {
        link: chunks => <a href="/docs" onClick={handleLinkClick}>{chunks}</a>,
      }).d('Please refer to the <link>document</link> for more detail.')}
    </span>
  );
};
```

## Usage Trend

[Usage Trend of react-intl-universal](https://npm-compare.com/react-intl-universal)

## License
This software is free to use under the BSD license.
