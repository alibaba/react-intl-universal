import React, { Component } from 'react'
import intl from 'react-intl-universal';

class Plural extends Component {

  render() {


    return (
      <div>
        <div className="title">Plural Examples:</div>
        <div>{intl.get("PHOTO", { photoNum: 0 }).defaultMessage(`你有"${photoNum}"张照片`)}</div>
        <div>{intl.get("PHOTO", { photoNum: 1 }).defaultMessage(`你有"${photoNum}"张照片`)}</div>
        <div>{intl.get("PHOTO", { photoNum: 1000000 }).d(`你有"${photoNum}"张照片`)}</div>
      </div>
    );
  }
}

export default Plural;
