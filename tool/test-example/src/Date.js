import React, { Component } from 'react'
import intl from 'react-intl-universal';

class DateComponent extends Component {
  render() {
    let start = new Date();
    let end = new Date();
    let expires = new Date();
    return (
      <div>
        <div className="title">Date Examples:</div>
        <div>{intl.get('SALE_START', { start })
          .defaultMessage(`拍卖将于${start}开始`)}</div>
        <div>{intl.get('SALE_END', { end }).defaultMessage(`拍卖将于${end}结束`)}</div>
      </div>
    )
  }
}

export default DateComponent;