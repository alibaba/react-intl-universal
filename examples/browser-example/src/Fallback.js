import React, { Component } from 'react'
import intl from 'react-intl-universal';

class FallbackComponent extends Component {
  render () {
    return (
      <div>
        <div className="title">Language Fallback:</div>
        <div>{intl.get('FALLBACK_NOT_EXIST_IN_ZH_TW')}</div>
        <div>{intl.get('FALLBACK_ONLY_EXIST_IN_EN')}</div>
      </div>
    )
  }
}

export default FallbackComponent;