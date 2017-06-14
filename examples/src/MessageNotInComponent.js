import React, { Component } from 'react'
import util from './util'

class MessageNotInComponent extends Component {
  render () {
    return (
      <div>
        <div className="title">Message Not in Component Example:</div>
        <div>{util.getMessage()}</div>
      </div>
    )
  }
}

export default MessageNotInComponent;