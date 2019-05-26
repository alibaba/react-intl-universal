import intl from "react-intl-universal";
import _ from "lodash";
import http from "axios";
import React, { Component } from "react";
import PluralComponent from "./Plural";
import BasicComponent from "./Basic";
import HtmlComponent from "./Html";
import DateComponent from "./Date";
import CurrencyComponent from "./Currency";
import MessageNotInComponent from "./MessageNotInComponent";
import "./app.css";

const SUPPOER_LOCALES = [
  {
    name: "English",
    value: "en-US"
  },
  {
    name: "简体中文",
    value: "zh-CN"
  },
  {
    name: "繁體中文",
    value: "zh-TW"
  },
  {
    name: "français",
    value: "fr-FR"
  },
  {
    name: "日本の",
    value: "ja-JP"
  }
];

class App extends Component {
  state = { initDone: false };

  constructor(props) {
    super(props);
    this.onSelectLocale = this.onSelectLocale.bind(this);
  }

  componentDidMount() {
    this.loadLocales();
  }

  render() {
    const HELLO_WORLD = 'hello';
    const a;

    intl.get('test0', { HELLO_WORLD }).defaultMessage(`test(0) 中文0 ${HELLO_WORLD}`);
    intl.getHTML('test0_html', { HELLO_WORLD }).defaultMessage(<span>{`test(0) 中文0 ${HELLO_WORLD}`}</span>);
    intl.get('test1', { HELLO_WORLD }).defaultMessage(`${HELLO_WORLD}中文1`);
    intl.get("test2").defaultMessage(`中文2${xxx}`); // Differenet quotation mark
    intl.get(`test3`).defaultMessage(`中文3`); // Differenet quotation mark

    intl.get('test4')
      .defaultMessage('中文44'); // '中文"4"'

    intl.get('test5')
      .defaultMessage('中文(5)');

    intl.get('test6')
      .d('中文6');
    intl.get('test10').d('请输入"123"(数字)');


    const a = true;
    const data = { x: 1 };
    intl.get("test11", { HELLO_WORLD }).defaultMessage(`中文11${HELLO_WORLD}`);
    intl.get("test12", { HELLO_WORLD }).defaultMessage(`中文12${HELLO_WORLD}`);
    intl.get("test13", { HELLO_WORLD }).defaultMessage(`中文13${HELLO_WORLD}`);
    intl.get("test14", { HELLO_WORLD }).defaultMessage(`中文14${HELLO_WORLD}`);

    console.log(intl.get('test15').d('测试15(test)'), 'ok');

    console.log(intl.get('test-16-uuid-format').d('测试16'), 'ok');

    intl.get("test17", { HELLO_WORLD: data.x }).defaultMessage(`中文17${HELLO_WORLD}`);

    a ? intl.get('same-line1').d('测试same line1') : intl.get('same-line2').d('测试same line2');

    intl.get("mutiple-line1", {
      HELLO_WORLD,
      a,
    }).defaultMessage(`测试mutiple-line1${HELLO_WORLD}${a}`);

    intl
      .get('mutiple-line2')
      .d('测试mutiple-line2');

    intl
      .get('switch_case_exporession_tips')
      .d(`条件表达式示例：${exp}>支持的操作符: ==,!=,>=,>,<=,<,&&,!,(),+,-,*,/,%`);

    return (
      this.state.initDone &&
      <div>
        {this.renderLocaleSelector()}
        <span>{intl.get('bandWidth').defaultMessage("带宽：") + (item.BandWidth || '')}</span>

        <BasicComponent />
        <PluralComponent />
        <HtmlComponent />
        <DateComponent />
        <CurrencyComponent />
        <MessageNotInComponent />
      </div>
    );
  }

  loadLocales() {
    let currentLocale = intl.determineLocale({
      urlLocaleKey: "lang",
      cookieLocaleKey: "lang"
    });
    if (!_.find(SUPPOER_LOCALES, { value: currentLocale })) {
      currentLocale = "en-US";
    }

    http
      .get(`locales/${currentLocale}.json`)
      .then(res => {
        console.log("App locale data", res.data);
        // init method will load CLDR locale data according to currentLocale
        return intl.init({
          currentLocale,
          locales: {
            [currentLocale]: res.data
          }
        });
      })
      .then(() => {
        // After loading CLDR locale data, start to render
        this.setState({ initDone: true });
      });
  }
}

export default App;
