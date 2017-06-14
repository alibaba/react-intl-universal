import React, {Component} from 'react'
import intl from 'react-intl-universal';

class Plural extends Component {
  render() {
    return (
      <div>
        <div className="title">Plural Examples:</div>
        <div>{intl.get('PHOTO', {num: 0})}</div>
        <div>{intl.get('PHOTO', {num: 1})}</div>
        <div>{intl.get('PHOTO', {num: 1000000})}</div>
      </div>
    )
  }
}

export default Plural;
