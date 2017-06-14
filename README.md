# react-intl-universal

## You May Not Need yahoo/react-intl

For many apps, we don't need the feature provided by [react-intl](https://github.com/yahoo/react-intl) which is able to change locale data dynamically without reloading page. However, if you don't need this feature, just use [react-intl-universal](https://www.npmjs.com/package/react-intl-universal). It can be used not only in React.Component but also in Vanilla JS.


## Why Another Internationalization Solution for React?
In case of internationalizing React apps, [react-intl](https://github.com/yahoo/react-intl) is one of most popular package in industry.  [react-intl](https://github.com/yahoo/react-intl) decorate your React.Component with wrapped component which is injected internationalized message dynamically so that the locale data is able to be loaded dynamically without reloading page. However, this approach introduces two major issues.

Firstly,  Internationalizing can only be applied in view layer such as React.Component. For Vanilla JS file, there's no way to internationalize it. For example, the following snippet is general form validator used by many React.Component in our apps. We definitely will not have such code separated in different React.Component in order to internationalize the warning message. Sadly, [react-intl](https://github.com/yahoo/react-intl) can't be used in Vanilla JS.

```
export default const rules = {
  noSpace(value) {
    if (value.includes(' ')) {
      return 'Space is not allowed.';
    }
  }
};
```

Secondly,  since your React.Component is wrapped by another class, the behavior is not as expected in many way. For example, to get the instance of React.Component, you can't use the normal way like:
```
class App {
  render() {
    <MyComponent ref="my"/>
  }
  getMyInstance() {
	console.log('getMyInstance', this.refs.my);
  }
}
```
Instead, use you need to use the method ```getWrappedInstance()``` to get that as below.
```
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
Furthermore, your React.Component's properties is not inherited in subclass since component is injected by [react-intl](https://github.com/yahoo/react-intl).


## react-intl-universal Features
- Can be used in Vanilla JS, not just in React.Component.
- Display numbers, currency, dates and times for different locales.
- Pluralize labels in strings.
- Support variables in message.
- Support HTML in message.
- Automatically load [Common Locale Data Repository (CLDR)](http://cldr.unicode.org/) locale data on demand. It's used for displaying numbers, currency, dates and times.
- Support for 150+ languages.
- Runs in the browser and Node.js.
- Message format is strictly implemented by [ICU standards](http://userguide.icu-project.org/formatparse/messages).

## Live Demo
[React Intl Universal Demo](http://g.alicdn.com/alishu/common/0.0.87/intl-example/index.html)


## Running Examples Locally
```
git clone git@github.com:alibaba/react-intl-universal.git
cd react-intl-universal/examples
npm install
npm start
```

## Get Started

### Install
```
npm install react-intl-universal --save
```

### Basic Example
In the following example, we initialize `intl` with app locale data (`locales`) and determine which locale is used dynamically (`currentLocale`). Then use `intl.get(...)` to get the internationalized message. That's all. Pretty simple!

Note that you are not necessary to load all locale data, just load the current locale data on demand. Please refer the [example](https://github.com/alibaba/react-intl-universal/blob/master/examples/src/App.js#L72-L88) for more detail.

```
import intl from 'react-intl-universal';

const locales = {
  "en-US": require('./locales/en-US.js'),
  "zh-CN": require('./locales/zh-CN.js'),
};

class App extends Component {

  state = {initDone: false}

  componentDidMount() {
    this.loadLocales();
  }

  loadLocales() {
    // init method will load CLDR locale data according to currentLocale
    intl.init({
      currentLocale: 'en-US', // TODO: determine locale here
      locales,
    })
    .then(()=>{
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
Locale data:
```
{ "HELLO": "Hello, {name}. Welcome to {where}!" }
```
JS code:
```
intl.get('HELLO', {name:'Tony', where:'Alibaba'}) // "Hello, Tony. Welcome to Alibaba!"
```
The second argument represents for variables. It will replace variables in the locale data with the value of second argument.

### Default Message
JS code:
```
intl.get('not-exist-key').defaultMessage('default message') // "default message"
```
If the key does't exist in current locale, it will return a default message if you append a `defaultMessage` method after `get` method.


### HTML Message
Locale data:
```
{ "TIP": "This is <span style='color:red'>HTML</span>" }
```
JS code:
```
intl.getHTML('TIP'); // {React element}
```

### Plural Form and Number Thousands Separators

Locale data:
```
{ "PHOTO": "You have {num, plural, =0 {no photos.} =1 {one photo.} other {# photos.}}" }
```
JS code:
```
intl.get('PHOTO', {num:0}); // "You have no photos."
intl.get('PHOTO', {num:1}); // "You have one photo."
intl.get('PHOTO', {num:1000000}); // "You have 1,000,000 photos."
```
Plural label supports standard [ICU Message syntax](http://userguide.icu-project.org/formatparse/messages).

Number thousands separators also varies according to the user's locale. According to this  [document](https://docs.oracle.com/cd/E19455-01/806-0169/overview-9/index.html), United States use a period to indicate the decimal place. Many other countries use a comma instead.

### Display Currency
Locale data:
```
{ "SALE_PRICE": "The price is {price, number, USD}" }
```
JS code:
```
intl.get('SALE_PRICE', {price:123456.78}); // The price is $123,456.78
```
As mentioned, the locale data is in [ICU Message format](http://userguide.icu-project.org/formatparse/messages).

The syntax is {name, type, format}. Here is description:

- name is the variable name in the message. In this case, it's `price`.
- type is the type of value such as `number`, `data`, and `time`.
- format is optional, and is additional information for the displaying format of the value. In this case, it's `USD`.

if `type` is `number` and `format` is omitted, the result is formatted number with [thousands separators](https://docs.oracle.com/cd/E19455-01/806-0169/overview-9/index.html). If `format` is one of [currency code](https://www.currency-iso.org/en/home/tables/table-a1.html), it will show in corresponding currency format.

### Display Dates
Locale data:
```
{
  "SALE_START": "Sale begins {start, date}",
  "SALE_END": "Sale ends {end, date, long}"
}
```
JS code:
```
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
```
{
  "COUPON": "Coupon expires at {expires, time, medium}"
}
```
JS code:
```
intl.get('COUPON', {expires:new Date()}); // Coupon expires at 6:45:44 PM
```
if `type` is `time`, `format` has the following values:
- `short` shows times with hours and minutes
- `medium` shows times with hours, minutes, and seconds
- `long` shows times with hours, minutes, seconds, and timezone

### Helper
`react-intl-universal` provides a utility helping developer determine the user's current locale. As the running examples, when user select a new locale, it redirect user new location like `http://localhost:3000?lang=en-US`. Then, we can use `intl.determineLocale` to get the locale from URL. It can also support determine user's locale via cookie and browser default language. Refer to the APIs section for more detail.

## APIs

```
  /**
   * Initialize properties and load CLDR locale data according to currentLocale
   * @param {Object} options
   * @param {string} options.currentLocale Current locale such as 'en-US'
   * @param {string} options.locales App locale data like {"en-US":{"key1":"value1"},"zh-CN":{"key1":"值1"}}
   * @returns {Promise}
   */
  init(options)

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
   * You may not this API, if you have other rules to determine user's locale.
   * @param {string} options.urlLocaleKey URL's query Key to determine locale. Example: if URL=http://localhost?lang=en-US, then set it 'lang'
   * @param {string} options.cookieLocaleKey Cookie's Key to determine locale. Example: if cookie=lang:en-US, then set it 'lang'
   * @returns {string} determined locale such as 'en-US'
   */
  determineLocale(options)
```

## Code Test Coverage Summary
```
Statements   : 84.75% ( 50/59 )
Branches     : 81.58% ( 31/38 )
Functions    : 90.91% ( 10/11 )
Lines        : 84.75% ( 50/59 )
```

## Browser Compatibility

Before using`react-intl-universal`, you need to include scripts below to support IE.
```
<!--[if lt IE 9]>
<script src="//f.alicdn.com/es5-shim/4.5.7/es5-shim.min.js"></script>
<![endif]-->
<!--[if IE]>
<script src="//f.alicdn.com/es6-shim/0.35.1/es6-shim.min.js"></script>
<![endif]-->
```

## License
This software is free to use under the BSD license.
