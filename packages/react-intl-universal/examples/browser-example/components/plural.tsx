import React from 'react'
import intl from 'react-intl-universal';

const PluralComponent: React.FC<any> = () => {
  return (
    <div>
      <div className="title">Plural Examples:</div>
      <div>{intl.get("PHOTO", { photoNum: 0 })}</div>
      <div>{intl.get("PHOTO", { photoNum: 1 })}</div>
      <div>{intl.get("PHOTO", { photoNum: 1000000 })}</div>
    </div>
  );
}

export default PluralComponent;