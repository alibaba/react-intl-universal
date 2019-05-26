import React, { Component } from 'react'
import intl from 'react-intl-universal';

class Html extends Component {
  render() {
    const abc = 'abc';
    const obj = { a: 1, b: 2 };
    return (
      <div>
        <div>{intl.getHTML('HTML0-uuid-format').d(<span>Tip 0</span>)}</div>
        <div>{intl.getHTML('HTML1').d(<span>Tip 1</span>)}</div>
        <div className="title">Html Examples:</div>
        <div>{intl.getHTML('HTML2').d(<span>(Tip 2)</span>)}</div>
        <div>{intl.getHTML('HTML3', { abc: 123 }).d(

          <span>{`Tip 3${abc}`}</span>

        )}</div>
        <div>{intl.getHTML('HTML4').defaultMessage(<b>Hello</b>)}</div>



        {
          intl.getHTML("HTML5").d(<div><span>he(l)lo</span><img src="https://www.npmjs.com/package/react-intl-universal" /></div>)
        }

        <div>{intl.getHTML('HTML-vairable', { abc: 123 }).defaultMessage(<b>Hello, {abc}</b>)}</div>
        <div>{intl.getHTML('HTML-mutiple-line', {
          HELLO_WORLD: obj.x,
          a: '1',
        }).defaultMessage(<b>Hello, {HELLO_WORLD} {a}</b>)}</div>

        <div>{intl.getHTML('HTML-same-line1').d(<span>same 1</span>) && intl.getHTML('HTML-same-line2').d(<span>same 2</span>)}</div>


      </div>
    )
  }
}

export default Html;
