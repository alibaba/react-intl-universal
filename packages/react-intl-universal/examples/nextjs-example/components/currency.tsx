import React from 'react'
import ExampleBlock from 'components/example-block';

const CurrencyComponent: React.FC<any> = () => {
  let price = 123456.78;
  return (
    <div>
      <div className="title">Number and currency formatting</div>
      <ExampleBlock code={"<div>{intl.get('SALE_PRICE', { price }).d('The price is {price, number, USD}')}</div>"} scope={{ price }} />
    </div>
  )
}

export default CurrencyComponent;
