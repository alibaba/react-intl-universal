import React from 'react'
import intl from 'react-intl-universal';

const CurrencyComponent: React.FC<any> = () => {
  let price = 123456.78;
  return (
    <div>
      <div className="title">Currency Example:</div>
      <div>{intl.get('SALE_PRICE', { price })}</div>
    </div>
  )
}

export default CurrencyComponent;