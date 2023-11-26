import React from 'react'
import intl from 'core/intl';

const DateComponent: React.FC<any> = () => {
  const start = new Date();
  const end = new Date();
  const expires = new Date();
  return (
    <div>
      <div className="title">Date Examples:</div>
      <div>{intl.get('SALE_START', { start })}</div>
      <div>{intl.get('SALE_END', { end })}</div>
      <div>{intl.get('COUPON', { expires })}</div>
    </div>
  )
}

export default DateComponent;