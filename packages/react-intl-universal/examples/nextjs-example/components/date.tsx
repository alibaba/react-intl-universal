import React from 'react'
import intl from 'core/intl';
import ExampleBlock from 'components/example-block';

const DateComponent: React.FC<any> = () => {
  const start = new Date();
  const end = new Date();
  const expires = new Date();
  return (
    <div>
      <div className="title">{intl.get('EXAMPLE_TITLE_DATE_TIME').d('Date and time formatting')}</div>
      <p className="section-note">
        {intl.get('EXAMPLE_NOTE_DATE_TIME').d('Format JavaScript Date values with intl.formatDate, intl.formatTime, or intl.formatDateTime, then pass the formatted value into intl.get. The helpers use stable defaults: YYYY-MM-DD, HH:mm:ss, and YYYY-MM-DD HH:mm:ss. Locale messages keep plain placeholders such as \'{start}\'.')}
      </p>
      <ExampleBlock code={"<div>{intl.get('SALE_START', { start: intl.formatDate(start) }).d('Sale begins {start}')}</div>"} scope={{ start }} />
      <ExampleBlock code={"<div>{intl.get('SALE_END', { end: intl.formatDateTime(end) }).d('Sale ends {end}')}</div>"} scope={{ end }} />
      <ExampleBlock code={"<div>{intl.get('COUPON', { expires: intl.formatTime(expires) }).d('Coupon expires at {expires}')}</div>"} scope={{ expires }} />
    </div>
  )
}

export default DateComponent;
