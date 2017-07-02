import React, {Component} from 'react'
import intl from 'react-intl-universal';

class Currency extends Component {
  render() {
    let price = 123456.78;
    return (
      <div>
        <div className="title">Currency Example:</div>
        <div>{intl.get('SALE_PRICE', {price})}</div>
      </div>
    )
  }
}

export default Currency;