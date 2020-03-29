import React, {Component} from 'react'
import intl from 'react-intl-universal';

class Html extends Component {
  render() {
    return (
      <div>
        <div className="title">Html Examples:</div>
        <div>{intl.getHTML('TIP')}</div>
        <div>{intl.getHTML('TIP_VAR', {message: 'HTML with variables'})}</div>
        <div>{intl.getHTML('TIP_VAR', {message: '<script>alert("ReactIntlUniversal prevents from xss attack")</script>'})}</div>
      </div>
    )
  }
}

export default Html;