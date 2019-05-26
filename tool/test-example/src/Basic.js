import React, { Component } from 'react'
import intl from 'react-intl-universal';

class BasicComponent extends Component {
  render() {
    const name = 'Tony';
    const where = 'Alibaba';
    return (
      <div>
        <div className="title">Basic Examples:</div>
        <div>
          {
            intl.get('SIMPLE').defaultMessage('this is default message')
          }
        </div>
        <div>{intl.get("HELLO", { name, where }).d(`Hello, ${name}. Welcome to ${where}!`)}</div>
      </div>
    )
  }
}

export default BasicComponent;
