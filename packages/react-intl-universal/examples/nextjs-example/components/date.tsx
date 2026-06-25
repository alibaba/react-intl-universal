import React from 'react'
import ExampleBlock from 'components/example-block';

const DateComponent: React.FC<any> = () => {
  const start = new Date();
  const end = new Date();
  const expires = new Date();
  return (
    <div>
      <div className="title">Date and time formatting</div>
      <ExampleBlock code={"<div>{intl.get('SALE_START', { start }).d('Sale begins {start, date}')}</div>"} scope={{ start }} />
      <ExampleBlock code={"<div>{intl.get('SALE_END', { end }).d('Sale ends {end, date, long}')}</div>"} scope={{ end }} />
      <ExampleBlock code={"<div>{intl.get('COUPON', { expires }).d('Coupon expires at {expires, time, medium}')}</div>"} scope={{ expires }} />
    </div>
  )
}

export default DateComponent;
