import intl from "react-intl-universal";
import React, { Component } from "react";
class App extends Component {

  render() {
    const name = 'Tony';
    const where = 'Alibaba';
    const webLink = 'https://www.npmjs.com/package/react-intl-extract';

    // HTML
    return (
      <div>
        {/*  Basic */}
        <div>{intl.get('basic1').defaultMessage('default message')}</div>
        <div>{intl.get('basic2').d('Default message for basic[2]')}</div>
        <div>{intl.get('basic3').d('Default message for basic(3)')}</div>
        <div>{intl.get('basic4').d('Default message for basic(4) with 中文')}</div>
        <div>{intl.get('basic5').d('Default message for basic5 with 中文(5)')}</div>
        <div>{intl.get('basic6').d('Default message for basic6 with "123(中文)"')}</div>

        {/* New line */}
        {
          intl.get('newline1')
            .defaultMessage('Default message for newline1')
        }
        {
          intl.get('newline2')
            .d('Default message for newline2')
        }
        {
          intl
            .get('newline3')
            .defaultMessage('Default message for newline1')
        }
        {
          intl
            .get('newline4')
            .d('Default message for newline2')
        }

        {/* Variable */}
        {
          intl.get("var1", { name, where }).d(`Hello1, ${name}. Welcome to ${where}!`)
        }
        {
          intl.get('var2', { name, where }).defaultMessage(`你好2, ${name}. 欢迎来到 ${where}！`)
        }
        {
          intl
            .get("var3", { name, where })
            .d(`Hello3, ${name}. Welcome to ${where}!`)
        }
        {
          intl
            .get('var4', { name, where })
            .defaultMessage(`你好4, ${name}. 欢迎来到 ${where}！`)
        }
        {
          intl.get("var5", {
            name,
            where,
          }).defaultMessage(`Hello5, ${name}. Welcome to ${where}!`)
        }

        {/* more character */}
        {
          intl
            .get('character1')
            .d(`Expression support: ==,!=,>=,>,<=,<,&&,!,(),+,-,*,/,%`)
        }

        {/* multiple i18in text in a line */}
        {
          name === 'Tony' ? intl.get('same_line1').d('Default message for same_line1') : intl.get('same-same_line2').d('Default message for same_line2')
        }

        <div>{intl.getHTML('html1').d(<span>This is html</span>)}</div>
        <div>{intl.getHTML('html2').defaultMessage(<span>This is html</span>)}</div>
        <div>{intl.getHTML('html3').d(<span>(This is html)</span>)}</div>
        <div>{intl.getHTML('html4', { name }).d(<span>Hello4 {name}</span>)}</div>
        <div>{intl.getHTML('html5', { name, webLink }).d(<span>Hello5 {name}, welcome to <a href={webLink}>my website!</a></span>)}</div>
        <div>{intl.getHTML("html6").d(<span>welcome to <a href="https://www.npmjs.com/package/react-intl-extract">my website</a></span>)}</div>

        <div>{intl.getHTML('html7', { name }).d(

          <span>Hello7 {name}</span>

        )}</div>

        <div>{intl.getHTML('html8').d(<span>html8</span>) && intl.getHTML('html9').d(<span>html9</span>)}</div>

      </div>

    );

  }

}

export default App;
